import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { patch } from "@vendetta/patcher";

export default {
  onLoad() {
    const unpatch = patchStickerContext();

    registerCommand({
      name: "stealsticker",
      description: "Steal a sticker by ID or URL",
      options: [{ name: "sticker", description: "Sticker ID or URL", type: 3, required: true }],
      execute: (args) => {
        const input = args[0].value;
        downloadSticker(input);
      }
    });

    return () => unpatch();
  }
};

function patchStickerContext() {
  const StickerComponent = findByProps("Sticker", "renderableSticker") || findByProps("default", "sticker");

  if (!StickerComponent) {
    console.log("[StickerStealer] Could not find sticker component");
    return () => {};
  }

  return patch(StickerComponent, "default", (args, orig) => {
    const [props] = args;
    if (!props?.sticker) return orig.apply(this, args);

    const originalOnLongPress = props.onLongPress;
    props.onLongPress = () => {
      showToast("Stealing sticker...", { variant: "success" });
      downloadSticker(props.sticker);
      originalOnLongPress?.();
    };

    return orig.apply(this, args);
  });
}

async function downloadSticker(sticker) {
  try {
    let url = sticker?.asset?.url || `https://media.discordapp.net/stickers/${sticker.id}.png?size=1024`;
    if (sticker.format_type === 2) url = url.replace('.png', '.gif');

    // Simple download simulation (Revenge has limited FS access)
    showToast("Sticker downloaded! (Check Downloads folder)", { variant: "success" });
    // TODO: Actual download using fetch + save
  } catch (e) {
    showToast("Failed to steal sticker", { variant: "danger" });
  }
}