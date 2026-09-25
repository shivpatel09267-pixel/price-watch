// The installed @firebase/auth version exports `getReactNativePersistence`
// at runtime (verified in node_modules/@firebase/auth/dist/rn/index.js),
// but its published .d.ts resolves to a generic "auth-public.d.ts" that
// omits this one function's signature (it does still export the
// `ReactNativeAsyncStorage` and `Persistence` types it depends on). This
// augments the module so TypeScript knows about it without patching
// node_modules.
//
// The top-level import (rather than one nested inside the `declare module`
// block) is what makes this file itself a module, which is what tells
// TypeScript to *merge* this declaration with the real one instead of
// replacing it.
import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
