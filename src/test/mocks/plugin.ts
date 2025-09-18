import { Plugin } from "../../lib/transport/plugins/plugin";
import { Context } from "../../lib/transport/context";
import { SdkSettings } from "../../lib";

export class JPluginMock implements Plugin {
  name = "JPluginMock";
  private funcs: JPluginMockFuncs;
  public constructor(funcs: JPluginMockFuncs) {
    this.funcs = funcs;
  }

  public updateSettings(sdkConfig: SdkSettings): void {
    return this.funcs?.updateSettings(sdkConfig);
  }

  public identify(ctx: Context): Promise<Context> | Context {
    return this.funcs?.identify(ctx);
  }

  public track(ctx: Context): Promise<Context> | Context {
    return this.funcs?.track(ctx);
  }

  public page(ctx: Context): Promise<Context> | Context {
    return this.funcs?.page(ctx);
  }

  public group(ctx: Context): Promise<Context> | Context {
    return this.funcs?.group(ctx);
  }
}

export interface JPluginMockFuncs {
  updateSettings?: jest.Func;
  identify?: jest.Func;
  track?: jest.Func;
  page?: jest.Func;
  group?: jest.Func;
}
