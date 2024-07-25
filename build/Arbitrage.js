"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Arbitrage = void 0;
exports.getBestCrossedMarket = getBestCrossedMarket;
const _ = __importStar(require("lodash"));
const ethers_1 = require("ethers");
const addresses_1 = require("./addresses");
const utils_1 = require("./utils");
// TODO: implement binary search (assuming linear/exponential global maximum profitability)
const TEST_VOLUMES = [
    utils_1.ETHER.div(100),
    utils_1.ETHER.div(10),
    utils_1.ETHER.div(6),
    utils_1.ETHER.div(4),
    utils_1.ETHER.div(2),
    utils_1.ETHER.div(1),
    utils_1.ETHER.mul(2),
    utils_1.ETHER.mul(5),
    utils_1.ETHER.mul(10),
];
function getBestCrossedMarket(crossedMarkets, tokenAddress) {
    let bestCrossedMarket = undefined;
    for (const crossedMarket of crossedMarkets) {
        const sellToMarket = crossedMarket[0];
        const buyFromMarket = crossedMarket[1];
        for (const size of TEST_VOLUMES) {
            const tokensOutFromBuyingSize = buyFromMarket.getTokensOut(addresses_1.USDT_ADDRESS, tokenAddress, size);
            const proceedsFromSellingTokens = sellToMarket.getTokensOut(tokenAddress, addresses_1.USDT_ADDRESS, tokensOutFromBuyingSize);
            const profit = proceedsFromSellingTokens.sub(size);
            if (bestCrossedMarket !== undefined &&
                profit.lt(bestCrossedMarket.profit)) {
                // If the next size up lost value, meet halfway. TODO: replace with real binary search
                const trySize = size.add(bestCrossedMarket.volume).div(2);
                const tryTokensOutFromBuyingSize = buyFromMarket.getTokensOut(addresses_1.USDT_ADDRESS, tokenAddress, trySize);
                const tryProceedsFromSellingTokens = sellToMarket.getTokensOut(tokenAddress, addresses_1.USDT_ADDRESS, tryTokensOutFromBuyingSize);
                const tryProfit = tryProceedsFromSellingTokens.sub(trySize);
                if (tryProfit.gt(bestCrossedMarket.profit)) {
                    bestCrossedMarket = {
                        volume: trySize,
                        profit: tryProfit,
                        tokenAddress,
                        sellToMarket,
                        buyFromMarket,
                    };
                }
                break;
            }
            bestCrossedMarket = {
                volume: size,
                profit: profit,
                tokenAddress,
                sellToMarket,
                buyFromMarket,
            };
        }
    }
    return bestCrossedMarket;
}
class Arbitrage {
    constructor(executorWallet, flashbotsProvider, bundleExecutorContract) {
        this.executorWallet = executorWallet;
        this.flashbotsProvider = flashbotsProvider;
        this.bundleExecutorContract = bundleExecutorContract;
    }
    static printCrossedMarket(crossedMarket) {
        const buyTokens = crossedMarket.buyFromMarket.tokens;
        const sellTokens = crossedMarket.sellToMarket.tokens;
        console.log(`Profit: ${(0, utils_1.bigNumberToDecimal)(crossedMarket.profit)} Volume: ${(0, utils_1.bigNumberToDecimal)(crossedMarket.volume)}\n` +
            `${crossedMarket.buyFromMarket.protocol} (${crossedMarket.buyFromMarket.marketAddress})\n` +
            `  ${buyTokens[0]} => ${buyTokens[1]}\n` +
            `${crossedMarket.sellToMarket.protocol} (${crossedMarket.sellToMarket.marketAddress})\n` +
            `  ${sellTokens[0]} => ${sellTokens[1]}\n` +
            `\n`);
    }
    async evaluateMarkets(marketsByToken) {
        const bestCrossedMarkets = new Array();
        for (const tokenAddress in marketsByToken) {
            const markets = marketsByToken[tokenAddress];
            const pricedMarkets = _.map(markets, (ethMarket) => {
                return {
                    ethMarket: ethMarket,
                    buyTokenPrice: ethMarket.getTokensIn(tokenAddress, addresses_1.USDT_ADDRESS, utils_1.ETHER.div(100)),
                    sellTokenPrice: ethMarket.getTokensOut(addresses_1.USDT_ADDRESS, tokenAddress, utils_1.ETHER.div(100)),
                };
            });
            const crossedMarkets = new Array();
            for (const pricedMarket of pricedMarkets) {
                _.forEach(pricedMarkets, (pm) => {
                    if (pm.sellTokenPrice.gt(pricedMarket.buyTokenPrice)) {
                        crossedMarkets.push([pricedMarket.ethMarket, pm.ethMarket]);
                    }
                });
            }
            const bestCrossedMarket = getBestCrossedMarket(crossedMarkets, tokenAddress);
            if (bestCrossedMarket !== undefined &&
                bestCrossedMarket.profit.gt(utils_1.ETHER.div(1000))) {
                bestCrossedMarkets.push(bestCrossedMarket);
            }
        }
        bestCrossedMarkets.sort((a, b) => a.profit.lt(b.profit) ? 1 : a.profit.gt(b.profit) ? -1 : 0);
        return bestCrossedMarkets;
    }
    // TODO: take more than 1
    async takeCrossedMarkets(bestCrossedMarkets, blockNumber, minerRewardPercentage) {
        for (const bestCrossedMarket of bestCrossedMarkets) {
            console.log("Send this much WETH", bestCrossedMarket.volume.toString(), "get this much profit", bestCrossedMarket.profit.toString());
            const buyCalls = await bestCrossedMarket.buyFromMarket.sellTokensToNextMarket(addresses_1.USDT_ADDRESS, bestCrossedMarket.volume, bestCrossedMarket.sellToMarket);
            const inter = bestCrossedMarket.buyFromMarket.getTokensOut(addresses_1.USDT_ADDRESS, bestCrossedMarket.tokenAddress, bestCrossedMarket.volume);
            const sellCallData = await bestCrossedMarket.sellToMarket.sellTokens(bestCrossedMarket.tokenAddress, inter, this.bundleExecutorContract.address);
            const targets = [
                ...buyCalls.targets,
                bestCrossedMarket.sellToMarket.marketAddress,
            ];
            const payloads = [...buyCalls.data, sellCallData];
            console.log({ targets, payloads });
            const minerReward = bestCrossedMarket.profit
                .mul(minerRewardPercentage)
                .div(100);
            const transaction = await this.bundleExecutorContract.populateTransaction.uniswapWeth(bestCrossedMarket.volume, minerReward, targets, payloads, {
                gasPrice: ethers_1.BigNumber.from(0),
                gasLimit: ethers_1.BigNumber.from(1000000),
            });
            try {
                const estimateGas = await this.bundleExecutorContract.provider.estimateGas({
                    ...transaction,
                    from: this.executorWallet.address,
                });
                if (estimateGas.gt(1400000)) {
                    console.log("EstimateGas succeeded, but suspiciously large: " +
                        estimateGas.toString());
                    continue;
                }
                transaction.gasLimit = estimateGas.mul(2);
            }
            catch (e) {
                console.warn(`Estimate gas failure for ${JSON.stringify(bestCrossedMarket)}`);
                continue;
            }
            const bundledTransactions = [
                {
                    signer: this.executorWallet,
                    transaction: transaction,
                },
            ];
            console.log(bundledTransactions);
            const signedBundle = await this.flashbotsProvider.signBundle(bundledTransactions);
            //
            const simulation = await this.flashbotsProvider.simulate(signedBundle, blockNumber + 1);
            if ("error" in simulation || simulation.firstRevert !== undefined) {
                console.log(`Simulation Error on token ${bestCrossedMarket.tokenAddress}, skipping`);
                continue;
            }
            console.log(`Submitting bundle, profit sent to miner: ${(0, utils_1.bigNumberToDecimal)(simulation.coinbaseDiff)}, effective gas price: ${(0, utils_1.bigNumberToDecimal)(simulation.coinbaseDiff.div(simulation.totalGasUsed), 9)} GWEI`);
            const bundlePromises = _.map([blockNumber + 1, blockNumber + 2], (targetBlockNumber) => this.flashbotsProvider.sendRawBundle(signedBundle, targetBlockNumber));
            await Promise.all(bundlePromises);
            return;
        }
        throw new Error("No arbitrage submitted to relay");
    }
}
exports.Arbitrage = Arbitrage;
//# sourceMappingURL=Arbitrage.js.map