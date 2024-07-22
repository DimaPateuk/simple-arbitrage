"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETHER = void 0;
exports.bigNumberToDecimal = bigNumberToDecimal;
exports.getDefaultRelaySigningKey = getDefaultRelaySigningKey;
const ethers_1 = require("ethers");
exports.ETHER = ethers_1.BigNumber.from(10).pow(18);
function bigNumberToDecimal(value, base = 18) {
    const divisor = ethers_1.BigNumber.from(10).pow(base);
    return value.mul(10000).div(divisor).toNumber() / 10000;
}
function getDefaultRelaySigningKey() {
    console.warn("You have not specified an explicity FLASHBOTS_RELAY_SIGNING_KEY environment variable. Creating random signing key, this searcher will not be building a reputation for next run");
    return ethers_1.Wallet.createRandom().privateKey;
}
//# sourceMappingURL=utils.js.map