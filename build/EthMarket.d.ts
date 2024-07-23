import { BigNumber } from "ethers";
export interface TokenBalances {
    [tokenAddress: string]: BigNumber;
}
export interface MultipleCallData {
    targets: Array<string>;
    data: Array<string>;
}
export interface CallDetails {
    target: string;
    data: string;
    value?: BigNumber;
}
export declare abstract class EthMarket {
    get tokens(): Array<string>;
    get marketAddress(): string;
    get protocol(): string;
    protected readonly _tokens: Array<string>;
    protected readonly _marketAddress: string;
    protected readonly _protocol: string;
    constructor(marketAddress: string, tokens: Array<string>, protocol: string);
    abstract getTokensOut(tokenIn: string, tokenOut: string, amountIn: BigNumber): BigNumber;
    abstract getTokensIn(tokenIn: string, tokenOut: string, amountOut: BigNumber): BigNumber;
    abstract sellTokensToNextMarket(tokenIn: string, amountIn: BigNumber, ethMarket: EthMarket): Promise<MultipleCallData>;
    abstract sellTokens(tokenIn: string, amountIn: BigNumber, recipient: string): Promise<string>;
    abstract receiveDirectly(tokenAddress: string): boolean;
    abstract prepareReceive(tokenAddress: string, amountIn: BigNumber): Promise<Array<CallDetails>>;
}
