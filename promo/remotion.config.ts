import { Config } from "@remotion/cli/config";

// PNG frames: dark gradients band badly when JPEG and H.264 compress them twice.
Config.setVideoImageFormat("png");
Config.setConcurrency(4);
Config.setOverwriteOutput(true);
