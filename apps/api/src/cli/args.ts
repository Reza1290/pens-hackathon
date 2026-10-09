export function requiredArg(name: string) {
  const args = process.argv.slice(2); const index = args.indexOf(`--${name}`);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Required argument: --${name} <value>`);
  return args[index + 1];
}
