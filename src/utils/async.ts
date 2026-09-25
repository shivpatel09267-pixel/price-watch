// Races a promise against a timeout so a slow/hung native call or network
// request can never leave the UI stuck waiting forever. Used for every
// location call (expo-location) and every Firestore read/write in the
// quick-log submit path — a flaky or slow connection should produce a
// clear "something went wrong, try again" within a few seconds, never an
// indefinite spinner.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
