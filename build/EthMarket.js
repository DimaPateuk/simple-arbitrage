"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthMarket = void 0;
class EthMarket {
    get tokens() {
        return this._tokens;
    }
    get marketAddress() {
        return this._marketAddress;
    }
    get protocol() {
        return this._protocol;
    }
    constructor(marketAddress, tokens, protocol) {
        this._marketAddress = marketAddress;
        this._tokens = tokens;
        this._protocol = protocol;
    }
}
exports.EthMarket = EthMarket;
//# sourceMappingURL=EthMarket.js.map