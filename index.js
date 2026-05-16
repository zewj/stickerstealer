import { findByProps } from "@vendetta/metro";
import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const MediaSaver = findByProps("downloadMediaAsset");
const ButtonModule = findByProps("Button", "TableRow") ?? findByProps("default", "Sizes", "Colors");
const Button = ButtonModule?.Button ?? ButtonModule?.default;

const STICKER_SHEET_NAMES = new Set([
  "StickerActionSheet",
  "StickerPreviewActionSheet",
  "PackDetailsActionSheet",
]);

function stickerURL(sticker) {
  const id = sticker?.id ?? sticker?.sticker_id;
  if (!id) return null;
  const format = sticker?.format_type ?? sticker?.formatType ?? 1;
  if (format === 4) return `https://media.discordapp.net/stickers/${id}.gif`;
  if (format === 3) return `https://discord.com/stickers/${id}.json`;
  return `https://media.discordapp.net/stickers/${id}.png?size=4096`;
}

function parseStickerInput(input) {
  const idMatch = String(input).match(/(\d{17,21})/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const isGif = /\.gif(\b|$)/i.test(input);
  const isLottie = /\.json(\b|$)/i.test(input);
  return {
    id,
    format_type: isGif ? 4 : isLottie ? 3 : 1,
    name: "sticker",
  };
}

function saveSticker(sticker) {
  const url = stickerURL(sticker);
  if (!url) {
    showToast("Could not resolve sticker URL", getAssetIDByName("Small"));
    return;
  }
  if (url.endsWith(".json")) {
    clipboard.setString(url);
    showToast("Lottie sticker URL copied (cannot save as image)", getAssetIDByName("toast_copy_link"));
    return;
  }
  const isAnimated = url.endsWith(".gif");
  MediaSaver.downloadMediaAsset(url, isAnimated ? 1 : 0);
  const dest = ReactNative.Platform.select({ android: "Downloads", default: "Camera Roll" });
  showToast(`Saved ${sticker.name ?? "sticker"} to ${dest}`, getAssetIDByName("toast_image_saved"));
}

function copyStickerURL(sticker) {
  const url = stickerURL(sticker);
  if (!url) {
    showToast("Could not resolve sticker URL", getAssetIDByName("Small"));
    return;
  }
  clipboard.setString(url);
  showToast(`Copied ${sticker.name ?? "sticker"}'s URL`, getAssetIDByName("toast_copy_link"));
}

function StealButtons({ sticker }) {
  if (!Button) return null;
  const dest = ReactNative.Platform.select({ android: "Downloads", default: "Camera Roll" });
  const style = { marginTop: ReactNative.Platform.select({ android: 12, default: 16 }) };

  const items = [
    {
      text: `Save sticker to ${dest}`,
      onPress: () => {
        saveSticker(sticker);
        LazyActionSheet.hideActionSheet();
      },
    },
    {
      text: "Copy URL to clipboard",
      onPress: () => {
        copyStickerURL(sticker);
        LazyActionSheet.hideActionSheet();
      },
    },
  ];

  return React.createElement(
    React.Fragment,
    null,
    ...items.map(({ text, onPress }, i) =>
      React.createElement(Button, {
        key: `stickerstealer-${i}`,
        color: Button.Colors?.BRAND,
        size: Button.Sizes?.SMALL,
        text,
        onPress,
        style,
      })
    )
  );
}

function injectIntoSheet(component, sticker) {
  const isButton = (c) => c?.type === Button || c?.type?.name === "Button";
  const buttonsContainer = findInReactTree(component, (c) => Array.isArray(c) && c.find?.(isButton));
  const stealNode = React.createElement(StealButtons, { sticker });

  if (buttonsContainer) {
    const idx = buttonsContainer.findLastIndex?.(isButton) ?? -1;
    buttonsContainer.splice(idx >= 0 ? idx + 1 : buttonsContainer.length, 0, stealNode);
    return;
  }

  const children = component?.props?.children;
  if (Array.isArray(children)) {
    children.push(stealNode);
  } else if (children) {
    component.props.children = [children, stealNode];
  }
}

function findStickerInProps(props) {
  if (!props) return null;
  return props.sticker ?? props.stickerItem ?? props.renderableSticker ?? null;
}

function patchStickerSheet() {
  if (!LazyActionSheet) {
    console.log("[StickerStealer] LazyActionSheet not found");
    return () => {};
  }

  const patches = [];

  const unpatch = before("openLazy", LazyActionSheet, ([lazySheet, name, props]) => {
    if (!STICKER_SHEET_NAMES.has(name)) return;

    const sticker = findStickerInProps(props);
    if (!sticker) return;

    lazySheet.then((module) => {
      const unpatchSheet = after("default", module, (_, res) => {
        React.useEffect(() => unpatchSheet, []);

        const view = res?.props?.children?.props?.children ?? res?.props?.children;
        if (!view) return;

        const unpatchView = after("type", view, (_, component) => {
          React.useEffect(() => unpatchView, []);
          injectIntoSheet(component, sticker);
        });
        patches.push(unpatchView);
      });
      patches.push(unpatchSheet);
    });
  });

  return () => {
    unpatch();
    for (const p of patches) try { p?.(); } catch {}
  };
}

let unpatchSheet;
let unregisterCommand;

export default {
  onLoad() {
    unpatchSheet = patchStickerSheet();

    unregisterCommand = registerCommand({
      name: "stealsticker",
      displayName: "stealsticker",
      description: "Steal a sticker by ID or URL",
      displayDescription: "Steal a sticker by ID or URL",
      type: 1,
      inputType: 1,
      applicationId: "-1",
      options: [
        {
          name: "sticker",
          displayName: "sticker",
          description: "Sticker ID or URL",
          displayDescription: "Sticker ID or URL",
          type: 3,
          required: true,
        },
      ],
      execute: (args) => {
        const input = args?.[0]?.value;
        const sticker = parseStickerInput(input);
        if (!sticker) {
          showToast("Could not find a sticker ID in input", getAssetIDByName("Small"));
          return;
        }
        saveSticker(sticker);
      },
    });
  },

  onUnload() {
    unpatchSheet?.();
    unregisterCommand?.();
  },
};
