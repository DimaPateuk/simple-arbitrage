export class FlashbotsBundleProvider {
  signBundle: any;
  simulate: any;
  sendRawBundle: any;
  static async create(...args: any) {
    return new FlashbotsBundleProvider();
  }
}
