import { BigNumber, Contract, providers } from "ethers";
import { CallDetails, EthMarket, MultipleCallData } from "./EthMarket";
import { MarketsByToken } from "./Arbitrage";
interface GroupedMarkets {
    marketsByToken: MarketsByToken;
    allMarketPairs: Array<UniswappyV2EthPair>;
}
export declare class UniswappyV2EthPair extends EthMarket {
    static uniswapInterface: Contract;
    private _tokenBalances;
    constructor(marketAddress: string, tokens: Array<string>, protocol: string);
    receiveDirectly(tokenAddress: string): boolean;
    prepareReceive(tokenAddress: string, amountIn: BigNumber): Promise<Array<CallDetails>>;
    static getUniswappyMarkets(provider: providers.JsonRpcProvider, factoryAddress: string): Promise<Array<UniswappyV2EthPair>>;
    static getUniswapMarketsByToken(provider: providers.JsonRpcProvider, factoryAddresses: Array<string>): Promise<GroupedMarkets>;
    static updateReserves(provider: providers.JsonRpcProvider, allMarketPairs: Array<UniswappyV2EthPair>): Promise<void>;
    getBalance(tokenAddress: string): BigNumber;
    setReservesViaOrderedBalances(balances: Array<BigNumber>): void;
    setReservesViaMatchingArray(tokens: Array<string>, balances: Array<BigNumber>): void;
    getTokensIn(tokenIn: string, tokenOut: string, amountOut: BigNumber): BigNumber;
    getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber;
    getAmountIn(reserveIn: BigNumber, reserveOut: BigNumber, amountOut: BigNumber): BigNumber;
    getAmountOut(reserveIn: BigNumber, reserveOut: BigNumber, amountIn: BigNumber): BigNumber;
    sellTokensToNextMarket(tokenIn: string, amountIn: BigNumber, ethMarket: EthMarket): Promise<MultipleCallData>;
    sellTokens(tokenIn: string, amountIn: BigNumber, recipient: string): Promise<string>;
}
export {};
