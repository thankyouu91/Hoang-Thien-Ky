// Mọi thứ cần three, gom một chỗ để index.ts nạp bằng một import() động.
export { getHost, type Host, type LiveMount, type ProgramFactory } from "./host.ts";
export { arenaBackFactory, arenaFrontFactory, bakeArenaWorld, hazeFactory, type ArenaLight, type WorldFrame } from "../scenes/arena.ts";
export { placeFactory, sceneFactory } from "../scenes/registry.ts";
