"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
const UniswappyV2EthPair_1 = require("./UniswappyV2EthPair");
const addresses_1 = require("./addresses");
const Arbitrage_1 = require("./Arbitrage");
const https_1 = require("https");
const utils_1 = require("./utils");
const dotenv_1 = require("dotenv");
const types_1 = require("./types");
(0, dotenv_1.config)();
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BUNDLE_EXECUTOR_ADDRESS = process.env.BUNDLE_EXECUTOR_ADDRESS || "";
const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || (0, utils_1.getDefaultRelaySigningKey)();
const MINER_REWARD_PERCENTAGE = parseInt(process.env.MINER_REWARD_PERCENTAGE || "80");
if (PRIVATE_KEY === "") {
    console.warn("Must provide PRIVATE_KEY environment variable");
    // process.exit(1);
}
if (BUNDLE_EXECUTOR_ADDRESS === "") {
    console.warn("Must provide BUNDLE_EXECUTOR_ADDRESS environment variable. Please see README.md");
    // process.exit(1);
}
if (FLASHBOTS_RELAY_SIGNING_KEY === "") {
    console.warn("Must provide FLASHBOTS_RELAY_SIGNING_KEY. Please see https://github.com/flashbots/pm/blob/main/guides/searcher-onboarding.md");
    // process.exit(1);
}
const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL || "";
const provider = new ethers_1.providers.StaticJsonRpcProvider(ETHEREUM_RPC_URL);
const arbitrageSigningWallet = new ethers_1.Wallet(PRIVATE_KEY);
const flashbotsRelaySigningWallet = new ethers_1.Wallet(FLASHBOTS_RELAY_SIGNING_KEY);
function healthcheck() {
    if (HEALTHCHECK_URL === "") {
        return;
    }
    (0, https_1.get)(HEALTHCHECK_URL).on("error", console.error);
}
async function main() {
    console.log("Searcher Wallet Address: " + (await arbitrageSigningWallet.getAddress()));
    console.log("Flashbots Relay Signing Wallet Address: " +
        (await flashbotsRelaySigningWallet.getAddress()));
    const flashbotsProvider = await types_1.FlashbotsBundleProvider.create(provider, flashbotsRelaySigningWallet);
    const arbitrage = new Arbitrage_1.Arbitrage(arbitrageSigningWallet, flashbotsProvider, new ethers_1.Contract(BUNDLE_EXECUTOR_ADDRESS, abi_1.BUNDLE_EXECUTOR_ABI, provider));
    const markets = await UniswappyV2EthPair_1.UniswappyV2EthPair.getUniswapMarketsByToken(provider, addresses_1.FACTORY_ADDRESSES);
    provider.on("block", async (blockNumber) => {
        console.time("takenTime");
        await UniswappyV2EthPair_1.UniswappyV2EthPair.updateReserves(provider, markets.allMarketPairs);
        const bestCrossedMarkets = await arbitrage.evaluateMarkets(markets.marketsByToken);
        console.timeEnd("takenTime");
        if (bestCrossedMarkets.length === 0) {
            // console.log("No crossed markets at block number", blockNumber);
            return;
        }
        bestCrossedMarkets.forEach(Arbitrage_1.Arbitrage.printCrossedMarket);
        arbitrage
            .takeCrossedMarkets(bestCrossedMarkets, blockNumber, MINER_REWARD_PERCENTAGE)
            .then(healthcheck)
            .catch(console.error);
    });
}
main();
//# sourceMappingURL=index.js.map