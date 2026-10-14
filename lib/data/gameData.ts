// The game data, loaded once when the server starts. Pages import this and pass
// it to client components as a prop. `server-only` makes the build fail if this
// file is ever imported into browser code (it reads files from disk).

import "server-only";
import { loadGameData } from "./load";

export const gameData = loadGameData();
