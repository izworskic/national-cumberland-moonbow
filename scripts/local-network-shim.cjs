// The Work Mode build container denies uv_interface_addresses. This shim is
// used only for local verification; Vercel and normal hosts do not need it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require("node:os");
os.networkInterfaces = () => ({});
