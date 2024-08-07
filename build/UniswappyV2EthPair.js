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
exports.UniswappyV2EthPair = void 0;
const _ = __importStar(require("lodash"));
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
const addresses_1 = require("./addresses");
const EthMarket_1 = require("./EthMarket");
const utils_1 = require("./utils");
// batch count limit helpful for testing, loading entire set of uniswap markets takes a long time to load
const BATCH_COUNT_LIMIT = 10;
const UNISWAP_BATCH_SIZE = 1000;
console.log(`BATCH_COUNT_LIMIT=${BATCH_COUNT_LIMIT} UNISWAP_BATCH_SIZE=${UNISWAP_BATCH_SIZE} `);
// Not necessary, slightly speeds up loading initialization when we know tokens are bad
// Estimate gas will ensure we aren't submitting bad bundles, but bad tokens waste time
const blacklistTokens = ["0xD75EA151a61d06868E31F8988D28DFE5E9df57B4"];
class UniswappyV2EthPair extends EthMarket_1.EthMarket {
    constructor(marketAddress, tokens, protocol) {
        super(marketAddress, tokens, protocol);
        this._tokenBalances = _.zipObject(tokens, [
            ethers_1.BigNumber.from(0),
            ethers_1.BigNumber.from(0),
        ]);
    }
    receiveDirectly(tokenAddress) {
        return tokenAddress in this._tokenBalances;
    }
    async prepareReceive(tokenAddress, amountIn) {
        if (this._tokenBalances[tokenAddress] === undefined) {
            throw new Error(`Market does not operate on token ${tokenAddress}`);
        }
        if (!amountIn.gt(0)) {
            throw new Error(`Invalid amount: ${amountIn.toString()}`);
        }
        // No preparation necessary
        return [];
    }
    static async getUniswappyMarkets(provider, factoryAddress) {
        const uniswapQuery = new ethers_1.Contract(addresses_1.UNISWAP_LOOKUP_CONTRACT_ADDRESS, abi_1.UNISWAP_QUERY_ABI, provider);
        const marketPairs = new Array();
        for (let i = 0; i < BATCH_COUNT_LIMIT * UNISWAP_BATCH_SIZE; i += UNISWAP_BATCH_SIZE) {
            const pairs = (await uniswapQuery.functions.getPairsByIndexRange(factoryAddress, i, i + UNISWAP_BATCH_SIZE))[0];
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                const marketAddress = pair[2];
                let tokenAddress;
                if (pair[0] === addresses_1.USDT_ADDRESS) {
                    tokenAddress = pair[1];
                }
                else if (pair[1] === addresses_1.USDT_ADDRESS) {
                    tokenAddress = pair[0];
                }
                else {
                    continue;
                }
                if (!blacklistTokens.includes(tokenAddress)) {
                    const uniswappyV2EthPair = new UniswappyV2EthPair(marketAddress, [pair[0], pair[1]], "");
                    marketPairs.push(uniswappyV2EthPair);
                }
            }
            if (pairs.length < UNISWAP_BATCH_SIZE) {
                break;
            }
        }
        return marketPairs;
    }
    static async getUniswapMarketsByToken(provider, factoryAddresses) {
        console.time("allPairs");
        const allPairs = await Promise.all(_.map(factoryAddresses, (factoryAddress) => UniswappyV2EthPair.getUniswappyMarkets(provider, factoryAddress)));
        console.timeEnd("allPairs");
        const marketsByTokenAll = _.chain(allPairs)
            .flatten()
            .groupBy((pair) => pair.tokens[0] === addresses_1.USDT_ADDRESS ? pair.tokens[1] : pair.tokens[0])
            .value();
        const allMarketPairs = _.chain(_.pickBy(marketsByTokenAll, (a) => a.length > 1) // weird TS bug, chain'd pickBy is Partial<>
        )
            .values()
            .flatten()
            .value();
        await UniswappyV2EthPair.updateReserves(provider, allMarketPairs);
        const marketsByToken = _.chain(allMarketPairs)
            .filter((pair) => pair.getBalance(addresses_1.USDT_ADDRESS).gt(utils_1.ETHER))
            .groupBy((pair) => pair.tokens[0] === addresses_1.USDT_ADDRESS ? pair.tokens[1] : pair.tokens[0])
            .value();
        return {
            marketsByToken,
            allMarketPairs,
        };
    }
    static async updateReserves(provider, allMarketPairs) {
        const uniswapQuery = new ethers_1.Contract(addresses_1.UNISWAP_LOOKUP_CONTRACT_ADDRESS, abi_1.UNISWAP_QUERY_ABI, provider);
        const pairAddresses = allMarketPairs.map((marketPair) => marketPair.marketAddress);
        // console.log("Updating markets, count:", pairAddresses.length);
        const reserves = (await uniswapQuery.functions.getReservesByPairs(pairAddresses))[0];
        for (let i = 0; i < allMarketPairs.length; i++) {
            const marketPair = allMarketPairs[i];
            const reserve = reserves[i];
            marketPair.setReservesViaOrderedBalances([reserve[0], reserve[1]]);
        }
    }
    getBalance(tokenAddress) {
        const balance = this._tokenBalances[tokenAddress];
        if (balance === undefined)
            throw new Error("bad token");
        return balance;
    }
    setReservesViaOrderedBalances(balances) {
        this.setReservesViaMatchingArray(this._tokens, balances);
    }
    setReservesViaMatchingArray(tokens, balances) {
        const tokenBalances = _.zipObject(tokens, balances);
        if (!_.isEqual(this._tokenBalances, tokenBalances)) {
            this._tokenBalances = tokenBalances;
        }
    }
    getTokensIn(tokenIn, tokenOut, amountOut) {
        const reserveIn = this._tokenBalances[tokenIn];
        const reserveOut = this._tokenBalances[tokenOut];
        return this.getAmountIn(reserveIn, reserveOut, amountOut);
    }
    getTokensOut(tokenIn, tokenOut, amountIn) {
        const reserveIn = this._tokenBalances[tokenIn];
        const reserveOut = this._tokenBalances[tokenOut];
        return this.getAmountOut(reserveIn, reserveOut, amountIn);
    }
    getAmountIn(reserveIn, reserveOut, amountOut) {
        const numerator = reserveIn.mul(amountOut).mul(1000);
        const denominator = reserveOut.sub(amountOut).mul(997);
        return numerator.div(denominator).add(1);
    }
    getAmountOut(reserveIn, reserveOut, amountIn) {
        const amountInWithFee = amountIn.mul(997);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(1000).add(amountInWithFee);
        return numerator.div(denominator);
    }
    async sellTokensToNextMarket(tokenIn, amountIn, ethMarket) {
        if (ethMarket.receiveDirectly(tokenIn) === true) {
            const exchangeCall = await this.sellTokens(tokenIn, amountIn, ethMarket.marketAddress);
            return {
                data: [exchangeCall],
                targets: [this.marketAddress],
            };
        }
        const exchangeCall = await this.sellTokens(tokenIn, amountIn, ethMarket.marketAddress);
        return {
            data: [exchangeCall],
            targets: [this.marketAddress],
        };
    }
    async sellTokens(tokenIn, amountIn, recipient) {
        // function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        let amount0Out = ethers_1.BigNumber.from(0);
        let amount1Out = ethers_1.BigNumber.from(0);
        let tokenOut;
        if (tokenIn === this.tokens[0]) {
            tokenOut = this.tokens[1];
            amount1Out = this.getTokensOut(tokenIn, tokenOut, amountIn);
        }
        else if (tokenIn === this.tokens[1]) {
            tokenOut = this.tokens[0];
            amount0Out = this.getTokensOut(tokenIn, tokenOut, amountIn);
        }
        else {
            throw new Error("Bad token input address");
        }
        const populatedTransaction = await UniswappyV2EthPair.uniswapInterface.populateTransaction.swap(amount0Out, amount1Out, recipient, []);
        if (populatedTransaction === undefined ||
            populatedTransaction.data === undefined)
            throw new Error("HI");
        return populatedTransaction.data;
    }
}
exports.UniswappyV2EthPair = UniswappyV2EthPair;
UniswappyV2EthPair.uniswapInterface = new ethers_1.Contract(addresses_1.USDT_ADDRESS, abi_1.UNISWAP_PAIR_ABI);
//# sourceMappingURL=UniswappyV2EthPair.js.map