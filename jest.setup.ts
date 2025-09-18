import crypto from "crypto";
import { TextEncoder, TextDecoder } from "util";

Object.assign(global, { TextDecoder, TextEncoder });

Object.defineProperty(globalThis, "crypto", {
  value: crypto,
});
