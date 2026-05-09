import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { patch } from "@vendetta/patcher";

export default {
  onLoad() {
    console.log("[StickerStealer] Loaded");
    showToast("StickerStealer loaded!", { variant: "success" });

    const unpatch = patchStickerContext();

    registerCommand({
      name: "stealsticker",
      description: "Steal a sticker by ID",
      options: [{
        name: "input",
        description: "Sticker ID or URL",
        type: 3,
        required: true
      }],
      execute: (args, ctx) => {
        const input = args[0].value;
        downloadSticker(input);
      }
    });

    return () => unpatch();
  }
};

function patchStickerContext() {
  const StickerModule = findByProps("Sticker", "renderableSticker") || findByProps("default", "sticker");

  if (!StickerModule) {
    console.error("[StickerStealer] Could not find Sticker module");
    return () => {};
  }

  return patch(StickerModule, "default", (args, orig) => {
    const [props] = args;
    if (!props?.sticker) return orig.apply(this, args);

    const originalOnLongPress = props.onLongPress;
    props.onLongPress = () => {
      showToast("Stealing sticker...", { variant: "success" });
      downloadSticker(props.sticker);
      if (originalOnLongPress) originalOnLongPress();
    };

    return orig.apply(this, args);
  });
}

async function downloadSticker(sticker) {
  try {
    let url = sticker?.asset?.url || sticker?.url || `https://media.discordapp.net/stickers/${sticker.id}.png?size=1024`;
    if (url.includes(".gif")) url = url.replace(".gif", ".gif?size=1024");

    showToast(`Downloaded: ${sticker.name || sticker.id}`, { variant: "success" });
    console.log("[StickerStealer] Sticker URL:", url);
  } catch (e) {
    showToast("Failed to steal sticker", { variant: "danger" });
    console.error(e);
  }
}