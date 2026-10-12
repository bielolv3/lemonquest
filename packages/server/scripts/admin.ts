// CLI do dono do servidor. Ver src/persistence/admincli.ts.
//   npm run admin -- reset-password <conta>
//   Docker: docker compose exec -u node lemonquest node --import tsx scripts/admin.ts reset-password <conta>
import { runAdminCli } from "../src/persistence/admincli.ts";

process.exitCode = await runAdminCli(process.argv.slice(2));
