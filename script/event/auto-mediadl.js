const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

const MAX_FILE_SIZE_MB = 84;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const cacheDir = path.join(__dirname, "/cache");

module.exports.config = {
  name: "auto-mediadl",
  version: "2.0.0",
};

module.exports.handleEvent = async function ({ api, event }) {
  const threadID = event.threadID;
  const message = event.body ? event.body.toLowerCase() : '';

  // Check if the message contains a valid media URL
  if (message.includes("instagram") || message.includes("facebook") || message.includes("tiktok") || message.includes("fb.watch")) {
    const url = extractLink(message);
    console.log(`Attempting to download from URL: ${url}`);

    if (url) {
      api.setMessageReaction("📥", event.messageID, (err) => {}, true);
      await downloadMedia(url, api, event);
    }
  }
};

async function downloadMedia(url, api, event) {
  const time = Date.now();
  const filePath = path.join(cacheDir, `${time}.mp4`);

  try {
    let videoUrl = "";
    if (url.includes("instagram")) {
      videoUrl = await getInstagramVideoUrl(url);
    } else if (url.includes("facebook") || url.includes("fb.watch")) {
      videoUrl = await getFacebookVideoUrl(url);
    } else if (url.includes("tiktok")) {
      videoUrl = await getTikTokVideoUrl(url);
    }

    if (videoUrl) {
      const response = await axios({ method: "GET", url: videoUrl, responseType: "arraybuffer" });
      if (response.data.length > MAX_FILE_SIZE_BYTES) {
        return api.sendMessage("The file is too large, cannot be sent", event.threadID, () => fs.unlinkSync(filePath), event.messageID);
      }

      fs.writeFileSync(filePath, Buffer.from(response.data));
      api.sendMessage({ body: "✅ Downloaded Successfully", attachment: fs.createReadStream(filePath) }, event.threadID, () => {
        fs.unlinkSync(filePath);
      }, event.messageID);
    } else {
      api.sendMessage("Failed to retrieve the video link.", event.threadID, event.messageID);
    }
  } catch (err) {
    console.error(err);
    api.sendMessage("An error occurred while downloading the media.", event.threadID, event.messageID);
  }
}

async function getInstagramVideoUrl(url) {
  const res = await axios.get(`https://kaizenji-autodl-api.gleeze.com/media?url=${encodeURIComponent(url)}`);
  return res.data.videoUrl || "";
}

async function getFacebookVideoUrl(url) {
  const res = await axios.get(`https://kaizenji-autodl-api.gleeze.com/media?url=${encodeURIComponent(url)}`);
  return res.data.hdUrl || res.data.sdUrl || "";
}

async function getTikTokVideoUrl(url) {
  const res = await axios.get(`https://kaizenji-autodl-api.gleeze.com/tiktok?url=${encodeURIComponent(url)}`);
  return res.data.videoUrl || "";
}

function extractLink(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}
