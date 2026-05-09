import { findByProps, findByName } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { patch } from "@vendetta/patcher";

export default {
  onLoad() {
    const unpatch = patchStickerContextMenu();

    // Register slash command
    const uncommand = registerCommand({
      name: "stealsticker",
      description: "Download a sticker by ID or URL",
      options: [
        {
          name: "input",
          description: "Sticker ID, URL, or name",
          type: 3, // STRING
          required: true,
        },
      ],
      execute: (args, ctx) => {
        const input = args[0].value;
        downloadSticker(input);
      },
    });

    return () => {
      unpatch();
      uncommand();
    };
  },
};

function patchStickerContextMenu() {
  const Sticker = findByName("Sticker", { default: true });

  if (!Sticker) {
    console.log("[StickerStealer] Could not find Sticker component");
    return () => {};
  }

  return patch(Sticker, "default", (args, orig) => {
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

async function downloadSticker(stickerOrInput) {
  try {
    let url = "";
    let filename = "sticker.png";

    if (typeof stickerOrInput === "string") {
      if (stickerOrInput.startsWith("http")) {
        url = stickerOrInput;
      } else {
        url = `https://media.discordapp.net/stickers/${stickerOrInput}.png`;
      }
      filename = `sticker_${Date.now()}.png`;
    } else if (stickerOrInput?.id) {
      const sticker = stickerOrInput;
      const format = sticker.format_type === 2 ? "gif" : "png";
      url = `https://media.discordapp.net/stickers/${sticker.id}.${format}?size=1024`;
      filename = `sticker_${sticker.id}.${format}`;
    }

    if (!url) throw new Error("No valid sticker URL");

    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    showToast("Sticker saved! 📥", { variant: "success" });
  } catch (e) {
    console.error(e);
    showToast("Failed to steal sticker 😢", { variant: "danger" });
  }
}
