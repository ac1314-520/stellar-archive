/* STELLAR ARCHIVE — series index & small shared helpers. */
(function () {
  "use strict";

  const SERIES = {
    molly: {
      key: "molly",
      name: "MOLLY",
      cn: "茉莉",
      collection: "星愿漫游",
      collectionEn: "WISHBOUND",
      accent: "#e9b3bd",
      accentDim: "#9f6f7b",
      hue: 345,
      keywords: ["molly", "茉莉", "莫莉"],
      intro: "把月光折进愿望里。",
    },
    dimoo: {
      key: "dimoo",
      name: "DIMOO",
      cn: "迪穆",
      collection: "云端旅人",
      collectionEn: "CLOUD WANDERER",
      accent: "#9dd3eb",
      accentDim: "#5d879a",
      hue: 200,
      keywords: ["dimoo", "迪穆", "迪莫"],
      intro: "从一朵云上，寄来晚安。",
    },
    skullpanda: {
      key: "skullpanda",
      name: "SKULLPANDA",
      cn: "骷髅熊猫",
      collection: "暗夜诗篇",
      collectionEn: "NOCTURNE",
      accent: "#b59bd1",
      accentDim: "#756287",
      hue: 273,
      keywords: ["skullpanda", "骷髅熊猫", "骷髅", "熊猫"],
      intro: "夜色是她的丝绒披风。",
    },
    labubu: {
      key: "labubu",
      name: "LABUBU",
      cn: "拉布布",
      collection: "森林顽童",
      collectionEn: "WOODLAND IMP",
      accent: "#cbd18e",
      accentDim: "#7f8555",
      hue: 73,
      keywords: ["labubu", "拉布布", "拉布", "森林"],
      intro: "森林深处，藏着一点顽皮。",
    },
    hirono: {
      key: "hirono",
      name: "HIRONO",
      cn: "小野",
      collection: "小小英雄",
      collectionEn: "LITTLE HERO",
      accent: "#d69c79",
      accentDim: "#8c6450",
      hue: 24,
      keywords: ["hirono", "小野", "希洛"],
      intro: "他沉默着，为你挡住风雪。",
    },
    crybaby: {
      key: "crybaby",
      name: "CRYBABY",
      cn: "哭娃",
      collection: "泪光花园",
      collectionEn: "TEAR GARDEN",
      accent: "#efb7c8",
      accentDim: "#966e7d",
      hue: 341,
      keywords: ["crybaby", "哭娃", "泪"],
      intro: "眼泪，也可以亮晶晶的。",
    },
    sweetbean: {
      key: "sweetbean",
      name: "SWEET BEAN",
      cn: "甜豆",
      collection: "甜梦小屋",
      collectionEn: "SUGAR HOUSE",
      accent: "#e9c38e",
      accentDim: "#91775a",
      hue: 35,
      keywords: ["sweetbean", "sweet bean", "甜豆"],
      intro: "把冬天的甜，烤得刚刚好。",
    },
    pucky: {
      key: "pucky",
      name: "PUCKY",
      cn: "毕奇",
      collection: "精灵奇遇",
      collectionEn: "ELF ENCOUNTER",
      accent: "#a9d3b6",
      accentDim: "#668472",
      hue: 147,
      keywords: ["pucky", "毕奇", "精灵"],
      intro: "蘑菇伞下，住着一个小小的精灵。",
    },
    nyota: {
      key: "nyota",
      name: "NYOTA",
      cn: "妮奥塔",
      collection: "星际漫游",
      collectionEn: "INTERSTELLAR",
      accent: "#b4b4e9",
      accentDim: "#70709b",
      hue: 244,
      keywords: ["nyota", "妮奥塔", "星际"],
      intro: "她从星环上，带回一颗愿望。",
    },
    zimomo: {
      key: "zimomo",
      name: "ZIMOMO",
      cn: "兹莫莫",
      collection: "雪境守望",
      collectionEn: "SNOW WATCH",
      accent: "#b7dfe0",
      accentDim: "#698a8b",
      hue: 183,
      keywords: ["zimomo", "兹莫莫", "雪境"],
      intro: "在雪线之上，为你留一盏灯。",
    },
  };

  const ORDER = [
    "molly",
    "dimoo",
    "skullpanda",
    "labubu",
    "hirono",
    "crybaby",
    "sweetbean",
    "pucky",
    "nyota",
    "zimomo",
  ];

  function findByKey(key) {
    return SERIES[key] || null;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) {
      const now = new Date();
      return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    }
    return String(value);
  }

  function pad(n, length = 2) {
    return String(n).padStart(length, "0");
  }

  window.STELLAR_SERIES = SERIES;
  window.STELLAR_SERIES_ORDER = ORDER;
  window.STELLAR_SERIES_FIND = findByKey;
  window.STELLAR_ESCAPE = escapeHTML;
  window.STELLAR_FORMAT_DATE = formatDate;
  window.STELLAR_PAD = pad;
})();
