#!/usr/bin/env python3
"""
STELLAR ARCHIVE — placeholder collection generator
Creates 200 original, editorial-style art-toy "sample photographs" so the museum
can be experienced before the real Pop Mart photos are shot.

No external images are used. Every plate is drawn procedurally with Pillow +
NumPy: studio background, bokeh, vinyl figure, rim light, grain and reflection.
"""

from __future__ import annotations

import colorsys
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
FULL_DIR = ROOT / "assets" / "photos" / "full"
THUMB_DIR = ROOT / "assets" / "photos" / "thumb"
DATA_FILE = ROOT / "js" / "collection-data.js"
PREVIEW_DIR = ROOT / "assets" / "preview"

W, H = 720, 900
SS = 2  # supersampling
CW, CH = W * SS, H * SS


# ---------------------------------------------------------------------------
# Series definitions
# ---------------------------------------------------------------------------

SERIES = [
    {
        "key": "molly",
        "name": "MOLLY",
        "cn": "茉莉",
        "collection": "星愿漫游",
        "collectionEn": "WISHBOUND",
        "palette": ["#efb6c2", "#f7d9c4", "#d99aae"],
        "hair": ["#f0d3ac", "#e7b7b6", "#d7b8f0"],
        "theme": {
            "bg_top": "#2c0b17",
            "bg_bottom": "#0b0306",
            "glow": "#ff789f",
            "haze": "#f9b7c9",
            "accent": "#f4c3cc",
        },
        "titles": [
            "月桂星愿", "雪夜茶会", "玫瑰信笺", "初雪圆舞", "冬青烛光",
            "梦游星港", "金铃回响", "梨云小憩", "午夜甜梦", "丝绒晨星",
            "松露晚宴", "莓色颂歌", "微光花园", "白昼焰火", "纸月来信",
            "雪松私语", "星屑桂冠", "暖灯序曲", "雾中芭蕾", "晚安银河",
        ],
        "titles_en": [
            "Moonlit Wish", "Snow Tea", "Rose Letter", "First Waltz", "Winterlight",
            "Astral Reverie", "Golden Echo", "Pearl Cloud", "Midnight Sugar", "Velvet Star",
            "Truffle Soirée", "Berry Carol", "Glimmer Garden", "Daylight Spark", "Paper Moon",
            "Cedar Whisper", "Stardust Crown", "Lamplight Prelude", "Ballet in Mist", "Galaxy Lullaby",
        ],
        "story": [
            "她把一小片月光折好，挂在了圣诞树最安静的枝头。",
            "雪落下来之前，她先替今晚许了一个甜甜的愿。",
            "铃铛轻响的那一刻，所有未说出口的喜欢都有了回声。",
            "她相信，愿望只要足够认真，就会在冬夜里发光。",
        ],
        # figure look
        "kind": "molly",
        "skin": "#f4ddcb",
        "outfit": "#e9aebc",
        "outfit2": "#6c263a",
        "eye": "#3c2524",
        "lip": "#b95463",
        "hair_style": "bob",
        "ear": "round",
        "eye_style": "pout",
    },
    {
        "key": "dimoo",
        "name": "DIMOO",
        "cn": "迪穆",
        "collection": "云端旅人",
        "collectionEn": "CLOUD WANDERER",
        "palette": ["#a9d8ee", "#c6e7f4", "#90bddb"],
        "hair": ["#e9f5ff", "#c8e3fa", "#f6d6e2"],
        "theme": {
            "bg_top": "#061522",
            "bg_bottom": "#03090f",
            "glow": "#71c9ff",
            "haze": "#b9e7ff",
            "accent": "#aadcf5",
        },
        "titles": [
            "云端初雪", "月亮邮差", "星海小憩", "蓝调颂歌", "微光航线",
            "冬日气球", "雪线以北", "银月入梦", "暖风邮局", "晨雾来信",
            "鲸落星河", "极光睡袋", "棉云礼盒", "风铃暗号", "晚安灯塔",
            "雾凇车站", "软糖星球", "候鸟时刻", "冰湖回声", "星轨摇篮",
        ],
        "titles_en": [
            "Cloud Snow", "Moon Courier", "Star Nap", "Blue Noël", "Glimmer Route",
            "Winter Balloon", "North of Snow", "Silver Dream", "Warm Post", "Mist Letter",
            "Whalefall", "Aurora Cocoon", "Cotton Gift", "Chime Code", "Lullaby Beacon",
            "Rime Station", "Gumdrop Planet", "Migratory Hour", "Ice Lake Echo", "Star Cradle",
        ],
        "story": [
            "他把一朵云装进口袋，打算在初雪那天寄给你。",
            "夜空是一张柔软的信纸，他用星轨写下了晚安。",
            "旅行的意义，是把自己最轻的那一部分，留在喜欢的人身边。",
            "每颗星星都在赶路，只有他愿意为你停一会儿。",
        ],
        "kind": "dimoo",
        "skin": "#f3dfce",
        "outfit": "#7cbfe3",
        "outfit2": "#173e58",
        "eye": "#2c303d",
        "lip": "#c4747c",
        "hair_style": "cloud",
        "ear": "round",
        "eye_style": "sleepy",
    },
    {
        "key": "skullpanda",
        "name": "SKULLPANDA",
        "cn": "骷髅熊猫",
        "collection": "暗夜诗篇",
        "collectionEn": "NOCTURNE",
        "palette": ["#b69ad1", "#8d729f", "#d8c3e8"],
        "hair": ["#27202c", "#47304d", "#d9cbe7"],
        "theme": {
            "bg_top": "#180a18",
            "bg_bottom": "#070307",
            "glow": "#c58cff",
            "haze": "#dcc5ff",
            "accent": "#c4a2dd",
        },
        "titles": [
            "夜巡玫瑰", "黑丝绒月", "荆棘颂歌", "午夜剧院", "鸦羽星冠",
            "暗香圆舞", "镜中挽歌", "冷杉女爵", "月蚀请柬", "紫雾圣咏",
            "提灯夜行", "鸦影来信", "银霜王座", "无声花火", "迷迭香颂",
            "子夜密语", "丝绒回声", "月桂刺青", "烬中星屑", "终幕晚安",
        ],
        "titles_en": [
            "Night Rose", "Black Velvet", "Thorn Hymn", "Midnight Theatre", "Raven Crown",
            "Dark Waltz", "Mirror Elegy", "Fir Duchess", "Eclipse Invite", "Violet Mass",
            "Lantern Walk", "Raven Letter", "Frost Throne", "Silent Spark", "Rosemary Ode",
            "Midnight Code", "Velvet Echo", "Laurel Ink", "Ember Dust", "Final Goodnight",
        ],
        "story": [
            "她收集夜色，也收集那些无人认领的心事。",
            "玫瑰在午夜盛开，像一封只给勇敢者看的信。",
            "黑丝绒盖住了喧闹，她却在安静里听见了整座城市的愿望。",
            "别怕夜色深，星星本来就是从黑暗里长出来的。",
        ],
        "kind": "skullpanda",
        "skin": "#eedfda",
        "outfit": "#302231",
        "outfit2": "#b592c4",
        "eye": "#4a2b56",
        "lip": "#8d3b58",
        "hair_style": "twintails",
        "ear": "round",
        "eye_style": "gothic",
    },
    {
        "key": "labubu",
        "name": "LABUBU",
        "cn": "拉布布",
        "collection": "森林顽童",
        "collectionEn": "WOODLAND IMP",
        "palette": ["#d9d69d", "#b8c482", "#e8deb3"],
        "hair": ["#e8dcb9", "#c6b485", "#f4e8ca"],
        "theme": {
            "bg_top": "#09170d",
            "bg_bottom": "#030805",
            "glow": "#b9d96d",
            "haze": "#e3e9b3",
            "accent": "#d6cb98",
        },
        "titles": [
            "松林来信", "榛果派对", "苔原星光", "雪地小兽", "青苔铃铛",
            "冬青顽童", "雾林迷踪", "橡果愿望", "篝火圆舞", "荒野茶席",
            "冷杉暗号", "月光旅团", "毛绒星夜", "松脂琥珀", "野莓雪原",
            "树洞邮局", "霜叶哨声", "麋鹿小径", "森林颂歌", "篝火晚安",
        ],
        "titles_en": [
            "Pine Letter", "Hazelnut Fête", "Tundra Star", "Snow Beast", "Moss Bell",
            "Holly Imp", "Mist Trail", "Acorn Wish", "Bonfire Waltz", "Wild Tea",
            "Fir Code", "Moon Troop", "Fuzzy Night", "Amber Resin", "Berry Snowfield",
            "Treehole Post", "Frost Whistle", "Reindeer Path", "Forest Carol", "Bonfire Lullaby",
        ],
        "story": [
            "他从森林深处跑来，怀里抱着一整个冬天的松果香气。",
            "如果快乐有声音，大概是铃铛被顽皮地摇了两下。",
            "别看他张牙舞爪，其实口袋里装满了想分给你的糖。",
            "雪地里的每一个脚印，都是他来找你的证据。",
        ],
        "kind": "labubu",
        "skin": "#d8c7a5",
        "outfit": "#9aac62",
        "outfit2": "#5b3f28",
        "eye": "#403026",
        "lip": "#7c4d42",
        "hair_style": "fur",
        "ear": "long",
        "eye_style": "grin",
    },
    {
        "key": "hirono",
        "name": "HIRONO",
        "cn": "小野",
        "collection": "小小英雄",
        "collectionEn": "LITTLE HERO",
        "palette": ["#d59875", "#b67555", "#e9b994"],
        "hair": ["#2f2420", "#493028", "#5d3b2c"],
        "theme": {
            "bg_top": "#1c0c09",
            "bg_bottom": "#080302",
            "glow": "#ff9b68",
            "haze": "#f2ba94",
            "accent": "#dba281",
        },
        "titles": [
            "小小英雄", "冬夜信使", "红色围巾", "旧梦放映", "壁炉余温",
            "雪原独行", "灯火归途", "无声勋章", "热可可夜", "屋顶星光",
            "皮革日记", "长夜将尽", "归家航线", "风中纸鹤", "篝火余烬",
            "晨光之前", "影子剧场", "旧城初雪", "微光骑士", "晚安旅人",
        ],
        "titles_en": [
            "Little Hero", "Winter Courier", "Red Scarf", "Old Cinema", "Fireside",
            "Snow Walker", "Way Home", "Silent Medal", "Cocoa Night", "Rooftop Star",
            "Leather Diary", "Before Dawn", "Home Route", "Paper Crane", "Ember Glow",
            "First Light", "Shadow Play", "Old Town Snow", "Glimmer Knight", "Night Traveler",
        ],
        "story": [
            "他不太会说话，却总在风雪最大的时候站在你前面。",
            "英雄不一定披着斗篷，有时只是系紧了一条红围巾。",
            "旧城的路灯一盏盏亮起，替他把回家的方向照得很远。",
            "今晚不必逞强，把口袋里的手交给温暖就好。",
        ],
        "kind": "hirono",
        "skin": "#eed5c3",
        "outfit": "#b65f38",
        "outfit2": "#3b2822",
        "eye": "#3d2c26",
        "lip": "#9c604f",
        "hair_style": "messy",
        "ear": "round",
        "eye_style": "serious",
    },
    {
        "key": "crybaby",
        "name": "CRYBABY",
        "cn": "哭娃",
        "collection": "泪光花园",
        "collectionEn": "TEAR GARDEN",
        "palette": ["#f4b8ca", "#e3a0b6", "#f9d4db"],
        "hair": ["#f4cfc5", "#d8aebc", "#f7ddc8"],
        "theme": {
            "bg_top": "#26101a",
            "bg_bottom": "#0b0408",
            "glow": "#ff9fc1",
            "haze": "#ffd1df",
            "accent": "#f3b8c8",
        },
        "titles": [
            "泪光花园", "想你的夜", "糖霜眼泪", "小雪人鱼", "粉红月亮",
            "雨天拥抱", "草莓雪崩", "心碎甜点", "晚安别哭", "奶油云朵",
            "铃兰泪滴", "初雪告白", "小熊创可贴", "蜜桃纸鹤", "不能说的糖",
            "冬夜暖手", "星星湿了", "玫瑰奶昔", "软糖伤口", "明天见呀",
        ],
        "titles_en": [
            "Tear Garden", "Miss You", "Sugar Tears", "Snow Mermaid", "Pink Moon",
            "Rain Hug", "Strawberry Fall", "Heartbreak Dessert", "Don't Cry", "Cream Cloud",
            "Lily Drop", "First Snow", "Bear Bandage", "Peach Crane", "Secret Candy",
            "Winter Hands", "Wet Stars", "Rose Shake", "Gummy Wound", "See You Tomorrow",
        ],
        "story": [
            "眼泪把星星洗得更亮了，她抬头的时候，正好看见愿望。",
            "难过可以慢慢来，今晚先把糖含在嘴里。",
            "她收集每一滴没有掉下来的眼泪，做成圣诞树上的小灯。",
            "别急着长大，先让我抱抱这个有一点委屈的你。",
        ],
        "kind": "crybaby",
        "skin": "#f6dfcf",
        "outfit": "#f3bcc9",
        "outfit2": "#a75d70",
        "eye": "#4a2e35",
        "lip": "#bd5f73",
        "hair_style": "curls",
        "ear": "round",
        "eye_style": "teary",
    },
    {
        "key": "sweetbean",
        "name": "SWEET BEAN",
        "cn": "甜豆",
        "collection": "甜梦小屋",
        "collectionEn": "SUGAR HOUSE",
        "palette": ["#f0cd9c", "#d9aa72", "#f7e4c3"],
        "hair": ["#b98254", "#8f5e39", "#e2bc8b"],
        "theme": {
            "bg_top": "#1d1106",
            "bg_bottom": "#080300",
            "glow": "#ffbd66",
            "haze": "#f9deb3",
            "accent": "#edc491",
        },
        "titles": [
            "姜饼小屋", "焦糖晚安", "奶油铃铛", "蜂蜜围巾", "可可雪人",
            "肉桂来信", "太妃糖梦", "栗子暖炉", "布丁圆舞", "曲奇星光",
            "香草冬夜", "焦糖烟花", "奶油泡芙", "豆豆暖手", "麦芽糖屋",
            "榛果被窝", "甜橙颂歌", "巧克力雪", "烤箱微光", "糖霜摇篮",
        ],
        "titles_en": [
            "Gingerbread House", "Caramel Night", "Cream Bell", "Honey Scarf", "Cocoa Snowman",
            "Cinnamon Letter", "Toffee Dream", "Chestnut Fire", "Pudding Waltz", "Cookie Star",
            "Vanilla Night", "Caramel Spark", "Cream Puff", "Warm Hands", "Malt House",
            "Hazelnut Nest", "Orange Carol", "Chocolate Snow", "Oven Light", "Icing Cradle",
        ],
        "story": [
            "把一小块姜饼放进热可可里，整个冬天就会甜得刚好。",
            "他负责烤饼干，也负责把最焦糖色的那一块偷偷留给你。",
            "小屋的烟囱冒着奶油味的烟，今晚谁都不用急着回家。",
            "甜豆说，幸福就是烤箱叮的一声，和门外熟悉的脚步声。",
        ],
        "kind": "sweetbean",
        "skin": "#f2dcc5",
        "outfit": "#dfb27e",
        "outfit2": "#8a4d2d",
        "eye": "#493428",
        "lip": "#a66556",
        "hair_style": "beanie",
        "ear": "round",
        "eye_style": "smile",
    },
    {
        "key": "pucky",
        "name": "PUCKY",
        "cn": "毕奇",
        "collection": "精灵奇遇",
        "collectionEn": "ELF ENCOUNTER",
        "palette": ["#b7dec6", "#8cbda5", "#d6ecd3"],
        "hair": ["#e7d6b0", "#bfa477", "#f3e7c9"],
        "theme": {
            "bg_top": "#071712",
            "bg_bottom": "#020806",
            "glow": "#66d8a8",
            "haze": "#c8ecd4",
            "accent": "#b4dcc1",
        },
        "titles": [
            "精灵奇遇", "苔藓铃兰", "雪松小帽", "雾气蘑菇", "星点萤火",
            "绿色月亮", "森林午睡", "露珠吊灯", "藤蔓邮差", "萤光茶会",
            "松针摇篮", "冬青精灵", "小小树神", "魔法苔原", "蘑菇伞下",
            "春信冬藏", "铃兰密语", "苔痕星图", "萤火山谷", "精灵晚安",
        ],
        "titles_en": [
            "Elf Encounter", "Moss Lily", "Cedar Hat", "Misty Mushroom", "Firefly Star",
            "Green Moon", "Forest Nap", "Dew Chandelier", "Vine Courier", "Glow Tea",
            "Pine Cradle", "Holly Elf", "Little Tree God", "Magic Tundra", "Under Mushroom",
            "Spring Kept", "Lily Code", "Moss Map", "Firefly Valley", "Elf Lullaby",
        ],
        "story": [
            "精灵把第一场雪藏进了蘑菇伞下，等到圣诞夜才肯打开。",
            "苔藓很软，月色很轻，适合做一场不愿醒来的梦。",
            "如果看见萤火绕着你转，那是森林在向你问好。",
            "最小的那棵树也有自己的星星，就像最小的愿望也值得被听见。",
        ],
        "kind": "pucky",
        "skin": "#f0dcc8",
        "outfit": "#8bb89b",
        "outfit2": "#456b54",
        "eye": "#3a3c2c",
        "lip": "#a66363",
        "hair_style": "elfhat",
        "ear": "pointed",
        "eye_style": "dreamy",
    },
    {
        "key": "nyota",
        "name": "NYOTA",
        "cn": "妮奥塔",
        "collection": "星际漫游",
        "collectionEn": "INTERSTELLAR",
        "palette": ["#b3b3ed", "#898acd", "#d8d4f5"],
        "hair": ["#292b4b", "#3e3c69", "#b1a9d9"],
        "theme": {
            "bg_top": "#080a22",
            "bg_bottom": "#020208",
            "glow": "#8d88ff",
            "haze": "#c9c4ff",
            "accent": "#b7b5ee",
        },
        "titles": [
            "星际漫游", "月背来信", "小行星夜", "银河缆车", "星环圆舞",
            "冬眠星球", "光年晚安", "紫色极光", "太空热可可", "孤独卫星",
            "流星信号", "宇宙微光", "星图地毯", "地球窗口", "月球背面",
            "太阳风铃", "失重拥抱", "星尘面包", "远星回声", "星河摇篮",
        ],
        "titles_en": [
            "Interstellar", "Far Side Letter", "Asteroid Night", "Galaxy Cable", "Ring Waltz",
            "Hibernation Planet", "Lightyear Night", "Violet Aurora", "Space Cocoa", "Lone Satellite",
            "Meteor Signal", "Cosmic Glimmer", "Star Map Rug", "Earth Window", "Moon's Back",
            "Solar Chime", "Weightless Hug", "Stardust Bread", "Far Star Echo", "Galaxy Cradle",
        ],
        "story": [
            "她沿着星环散步，捡到一颗还没被命名的愿望。",
            "宇宙很大，但今晚所有光年都在替她说一句晚安。",
            "她把地球的雪装进玻璃瓶，带去给月球背面的朋友看。",
            "失重的时候，拥抱会变得更轻，也更久。",
        ],
        "kind": "nyota",
        "skin": "#e8d6c8",
        "outfit": "#7375b4",
        "outfit2": "#20264e",
        "eye": "#302e48",
        "lip": "#a46175",
        "hair_style": "sleekbob",
        "ear": "round",
        "eye_style": "star",
    },
    {
        "key": "zimomo",
        "name": "ZIMOMO",
        "cn": "兹莫莫",
        "collection": "雪境守望",
        "collectionEn": "SNOW WATCH",
        "palette": ["#c8e9e4", "#9bcfc9", "#e7f5ef"],
        "hair": ["#f4f4eb", "#dfe6dc", "#c7d6d0"],
        "theme": {
            "bg_top": "#07171e",
            "bg_bottom": "#02070a",
            "glow": "#7cdfe8",
            "haze": "#d3f4f3",
            "accent": "#bfe2dd",
        },
        "titles": [
            "雪境守望", "白夜旅人", "冰川心跳", "极地来信", "雪怪茶会",
            "月光绒毯", "雪线之上", "沉默灯塔", "冰湖倒影", "北境圆舞",
            "霜花信笺", "雪松铃声", "暖流抵达", "企鹅邮差", "冻原星光",
            "极夜篝火", "北极星下", "雪地拥抱", "冰川回声", "长夜晚安",
        ],
        "titles_en": [
            "Snow Watch", "White Night", "Glacier Heart", "Polar Letter", "Yeti Tea",
            "Moon Fleece", "Above Snowline", "Silent Lighthouse", "Ice Lake", "Northern Waltz",
            "Frost Letter", "Cedar Bell", "Warm Current", "Penguin Post", "Tundra Star",
            "Polar Fire", "Under Polaris", "Snow Hug", "Glacier Echo", "Long Night",
        ],
        "story": [
            "他在雪线之上守夜，替每一个晚归的人留了一盏灯。",
            "雪怪看起来很大，其实心里住着一只怕冷的小动物。",
            "冰川走得很慢，但每一寸都记得温暖来过的方向。",
            "今晚的极夜很长，幸好拥抱足够亮。",
        ],
        "kind": "zimomo",
        "skin": "#d7e3dc",
        "outfit": "#7fbdb7",
        "outfit2": "#315d5b",
        "eye": "#304347",
        "lip": "#6f8b86",
        "hair_style": "furwhite",
        "ear": "longwhite",
        "eye_style": "wide",
    },
]

QUOTES_HIDDEN = [
    "本馆藏为星夜限定隐藏款，全球仅此一件。",
    "她从极光背后取回了这枚颜色，因此它只出现一次。",
]
RARITY = ["常规款", "限定款", "隐藏款"]
BASE_DATE = (2026, 11, 19)

# Props drawn beside the figure
PROPS = ["bauble", "candy", "star", "gift", "candle", "tree", "letter", "globe", "bell", "none"]


# ---------------------------------------------------------------------------
# Color / drawing helpers
# ---------------------------------------------------------------------------

def hex2rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(value: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*[max(0, min(255, int(v))) for v in value])


def shift_sat(value: str, lightness=0.0, saturation=1.0, hue=0.0) -> str:
    r, g, b = [v / 255 for v in hex2rgb(value)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + hue) % 1.0
    l = max(0.02, min(0.98, l + lightness))
    s = max(0.0, min(1.0, s * saturation))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return rgb2hex((r * 255, g * 255, b * 255))


def mix(a: str, b: str, t: float) -> str:
    ca, cb = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(ca[i] * (1 - t) + cb[i] * t for i in range(3)))


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    return (*hex2rgb(value), max(0, min(255, int(alpha))))


def vertical_gradient(w: int, h: int, top: str, bottom: str) -> Image.Image:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    c0 = np.array(hex2rgb(top), dtype=np.float32)[None, None, :]
    c1 = np.array(hex2rgb(bottom), dtype=np.float32)[None, None, :]
    arr = (c0 * (1 - t) + c1 * t)
    return Image.fromarray(np.repeat(arr.astype(np.uint8), w, axis=1), "RGB")


def radial_overlay(w: int, h: int, center, radius, color, strength, ellipse=(1, 1)) -> Image.Image:
    """Return an RGBA radial glow overlay."""
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx - center[0]) / (radius * ellipse[0])
    dy = (yy - center[1]) / (radius * ellipse[1])
    d = np.sqrt(dx * dx + dy * dy)
    falloff = np.clip(1 - d, 0, 1) ** 2.2
    alpha = (falloff * strength * 255).astype(np.uint8)
    rgb = np.array(hex2rgb(color), dtype=np.uint8)[None, None, :]
    arr = np.repeat(rgb, h, axis=0)
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(np.dstack([arr, alpha]), "RGBA")


def screen_layer(base: Image.Image, layer: Image.Image) -> Image.Image:
    if base.mode != "RGB":
        base = base.convert("RGB")
    rgb = base.convert("RGB")
    overlay = Image.new("RGB", base.size, (0, 0, 0))
    overlay.paste(layer, (0, 0), layer)
    return ImageChops.screen(rgb, overlay)


def add_grain(img: Image.Image, seed: int, amount: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    arr = np.asarray(img).astype(np.int16)
    noise = rng.normal(0, amount, (img.height, img.width, 1)).astype(np.int16)
    # Slightly stronger grain in shadows
    shadow = np.clip(1.08 - arr.mean(axis=2, keepdims=True) / 255.0, 0.15, 1.0)
    noise = (noise * (0.55 + 0.45 * shadow)).astype(np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def vignette(img: Image.Image, strength: float = 0.7) -> Image.Image:
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx - w / 2) / (w * 0.68)
    dy = (yy - h / 2) / (h * 0.70)
    d = np.sqrt(dx * dx + dy * dy)
    shade = np.clip((d - 0.34) / 0.95, 0, 1) ** 1.5 * strength
    arr = np.asarray(img).astype(np.float32)
    arr *= (1 - shade)[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def ellipse_blur_mask(size, box, blur=0):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
    return mask


def soft_shadow(layer: Image.Image, box, blur=35, color=(0, 0, 0), opacity=120) -> None:
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse(box, fill=(*color, opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    layer.alpha_composite(shadow)


# ---------------------------------------------------------------------------
# Background
# ---------------------------------------------------------------------------

def make_background(seed: int, series: dict, variant: int) -> Image.Image:
    rng = random.Random(seed)
    theme = series["theme"]
    img = vertical_gradient(CW, CH, theme["bg_top"], theme["bg_bottom"]).convert("RGBA")

    cx = CW * 0.52
    cy = CH * 0.46
    halo = radial_overlay(CW, CH, (cx, cy - CH * 0.10), CH * 0.50, theme["glow"], 0.34, (1.0, 1.05))
    img = Image.alpha_composite(img, halo)
    floor_glow = radial_overlay(CW, CH, (cx, CH * 0.79), CW * 0.56, theme["glow"], 0.22, (1.0, 0.22))
    img = Image.alpha_composite(img, floor_glow)

    # Soft architectural light shafts.
    shafts = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shafts)
    for idx in range(3):
        offset = (idx - 1) * CW * 0.16 + rng.uniform(-30, 30)
        topx = CW * 0.52 + offset * 0.24
        sd.polygon(
            [
                (topx - CW * 0.02, 0),
                (topx + CW * 0.08, 0),
                (CW * 0.54 + offset * 0.9 + CW * 0.34, CH),
                (CW * 0.54 + offset * 0.9 - CW * 0.05, CH),
            ],
            fill=rgba(theme["haze"], 7 + idx * 2),
        )
    shafts = shafts.filter(ImageFilter.GaussianBlur(34))
    img.alpha_composite(shafts)

    # Background bokeh / ornaments.
    bokeh = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bokeh)
    count = 30 if variant != 2 else 12
    for _ in range(count):
        x = rng.uniform(-0.06, 1.06) * CW
        y = rng.uniform(0.03, 0.72) * CH
        r = rng.uniform(0.008, 0.075) * CW
        a = rng.randint(6, 34)
        col = theme["accent"] if rng.random() > 0.35 else theme["glow"]
        if rng.random() > 0.58:
            bd.ellipse((x - r, y - r, x + r, y + r), fill=rgba(col, a))
            if r > CW * 0.025:
                bd.ellipse((x - r * 0.68, y - r * 0.68, x + r * 0.68, y + r * 0.68),
                           fill=rgba(theme["bg_bottom"], int(a * 0.9)))
        else:
            bd.ellipse((x - r, y - r, x + r, y + r), outline=rgba(col, a + 16), width=rng.randint(1, 3))
    bokeh = bokeh.filter(ImageFilter.GaussianBlur(7))
    img.alpha_composite(bokeh)

    # Faint garland arcs / hanging lights.
    arcs = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    if variant in (0, 2):
        for k in range(3):
            x0 = -CW * 0.10 + k * CW * 0.40
            box = (x0, CH * rng.uniform(0.06, 0.14), x0 + CW * (0.75 + k * 0.10), CH * 0.60)
            ad.arc(box, 8, 172, fill=rgba(theme["accent"], 16), width=2)
            for p in range(13):
                ang = math.radians(12 + p * 12.8)
                x = x0 + (box[2] - box[0]) / 2 + math.cos(ang) * (box[2] - box[0]) / 2
                y = (box[1] + box[3]) / 2 + math.sin(ang) * (box[3] - box[1]) / 2
                rr = rng.uniform(1.5, 4.0) * SS
                ad.ellipse((x - rr, y - rr, x + rr, y + rr), fill=rgba(theme["haze"], rng.randint(40, 110)))
    arcs = arcs.filter(ImageFilter.GaussianBlur(2.4))
    img.alpha_composite(arcs)

    # Frosted floor line.
    floor = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor)
    fy = int(CH * 0.785)
    fd.ellipse((CW * 0.12, fy - CH * 0.08, CW * 0.88, fy + CH * 0.10),
               fill=rgba(theme["haze"], 12))
    fd.line((CW * 0.06, fy, CW * 0.94, fy), fill=rgba(theme["haze"], 28), width=2)
    floor = floor.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(floor)

    return img


# ---------------------------------------------------------------------------
# Figure primitives
# ---------------------------------------------------------------------------

class Figure:
    def __init__(self, canvas: Image.Image, seed: int, series: dict):
        self.img = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.img)
        self.seed = seed
        self.rng = random.Random(seed)
        self.series = series
        self.S = SS
        self.cx = CW * (0.50 + self.rng.uniform(-0.025, 0.025))
        self.base_y = CH * (0.795 + self.rng.uniform(-0.008, 0.012))
        self.height = CH * (0.55 + self.rng.uniform(-0.012, 0.022))
        self.head_r = self.height * 0.205
        self.head_cy = self.base_y - self.height * 0.735
        self.body_top = self.head_cy + self.head_r * 0.72
        self.body_bottom = self.base_y - self.height * 0.105
        self.body_w = self.height * 0.225
        self.skin = series["skin"]
        self.outfit = series["outfit"]
        self.outfit2 = series["outfit2"]
        self.accent = series["palette"][0]
        self.hair_col = series["hair"][self.rng.randrange(len(series["hair"]))]
        self.eye_col = series["eye"]
        self.lip = series["lip"]
        self.prop = PROPS[self.rng.randrange(len(PROPS))]
        self.pose = self.rng.choice(["arms_down", "one_up", "bauble", "wave", "hold"])
        self.hat = self.rng.choice(["none", "none", "santa", "antlers", "earmuff", "starclip", "crown"])
        self.scarf = self.rng.random() < 0.52

    def y(self, value):
        return value

    def circle(self, x, y, r, fill=None, outline=None, width=0):
        self.draw.ellipse((x - r, y - r, x + r, y + r), fill=fill, outline=outline, width=width)

    def soft_ellipse(self, box, fill, alpha, blur=0):
        """Alpha-blend a soft shape instead of replacing figure pixels."""
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse(box, fill=rgba(fill, alpha))
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur))
        self.img.alpha_composite(layer)

    def soft_arc(self, box, start, end, fill, alpha, width, blur=0):
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).arc(box, start, end, fill=rgba(fill, alpha), width=width)
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur))
        self.img.alpha_composite(layer)

    def capsule(self, x1, y1, x2, y2, width, fill, outline=None):
        r = width / 2
        self.draw.line((x1, y1, x2, y2), fill=fill, width=width)
        self.circle(x1, y1, r, fill, outline)
        self.circle(x2, y2, r, fill, outline)

    # --- silhouette / body -------------------------------------------------

    def draw_shadow(self):
        soft_shadow(
            self.img,
            (self.cx - self.height * 0.34, self.base_y - self.height * 0.025,
             self.cx + self.height * 0.34, self.base_y + self.height * 0.075),
            blur=int(self.height * 0.06),
            color=hex2rgb(self.series["theme"]["bg_bottom"]),
            opacity=205,
        )
        # Warm light pool directly beneath the toy.
        pool = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        pd = ImageDraw.Draw(pool)
        pd.ellipse(
            (self.cx - self.height * 0.38, self.base_y - self.height * 0.05,
             self.cx + self.height * 0.38, self.base_y + self.height * 0.045),
            fill=rgba(self.series["theme"]["glow"], 60),
        )
        pool = pool.filter(ImageFilter.GaussianBlur(int(self.height * 0.035)))
        self.img.alpha_composite(pool)

    def draw_reflection(self):
        if self.img.getbbox() is None:
            return
        region = self.img.crop(self.img.getbbox())
        if region.height < 10:
            return
        flipped = region.transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert("RGBA")
        alpha = flipped.getchannel("A")
        fade = Image.new("L", alpha.size, 0)
        fd = ImageDraw.Draw(fade)
        for i in range(fade.height):
            fd.line((0, i, fade.width, i), fill=int(58 * (1 - i / max(1, fade.height)) ** 2))
        alpha = ImageChops.multiply(alpha, fade)
        flipped.putalpha(alpha)
        flipped = flipped.filter(ImageFilter.GaussianBlur(5 * self.S))
        x = self.cx - flipped.width / 2
        y = self.base_y + self.height * 0.012
        self.img.alpha_composite(flipped, (int(x), int(y)))

    def draw_legs(self):
        h = self.height
        leg_w = h * 0.085
        gap = h * 0.045
        leg_top = self.body_bottom - h * 0.035
        shoe_h = h * 0.065
        for side in (-1, 1):
            x = self.cx + side * (leg_w * 0.62 + gap)
            col = self.outfit2 if side < 0 else self.outfit2
            self.capsule(x, leg_top, x + side * h * 0.005, self.base_y - shoe_h * 0.9, int(leg_w), rgba(col))
            # boot
            boot_col = mix(self.outfit2, "#161014", 0.40)
            self.draw.rounded_rectangle(
                (x - leg_w * 0.75 - (h * 0.035 if side < 0 else 0),
                 self.base_y - shoe_h,
                 x + leg_w * 0.75 + (h * 0.035 if side > 0 else 0),
                 self.base_y + shoe_h * 0.08),
                radius=int(shoe_h * 0.55), fill=rgba(boot_col),
            )
            self.soft_ellipse(
                (x - leg_w * 0.60, self.base_y - shoe_h * 0.97,
                 x + leg_w * 0.35, self.base_y - shoe_h * 0.58),
                mix(boot_col, "#ffffff", 0.28), 80, blur=SS * 2,
            )

    def draw_body(self):
        h = self.height
        top = self.body_top
        bottom = self.body_bottom
        w = self.body_w
        # coat / sweater silhouette, slightly flared
        body_col = self.outfit
        self.draw.rounded_rectangle(
            (self.cx - w, top, self.cx + w, bottom),
            radius=int(w * 0.43), fill=rgba(body_col),
        )
        # lower highlight
        self.soft_ellipse(
            (self.cx - w * 0.82, bottom - h * 0.12, self.cx + w * 0.82, bottom + h * 0.012),
            mix(body_col, "#ffffff", 0.32), 95, blur=SS * 5,
        )
        # coat volume: soft light on the left, shade on the right
        self.soft_ellipse(
            (self.cx - w * 0.95, top + h * 0.02, self.cx - w * 0.10, bottom - h * 0.02),
            mix(body_col, "#ffffff", 0.40), 50, blur=SS * 9,
        )
        self.soft_ellipse(
            (self.cx + w * 0.45, top + h * 0.03, self.cx + w * 1.08, bottom + h * 0.01),
            mix(body_col, "#4a2432", 0.30), 74, blur=SS * 8,
        )
        # collar / scarf
        neck_y = top + h * 0.02
        if self.scarf:
            scarf_col = mix(self.outfit2, self.series["theme"]["glow"], 0.35)
            self.draw.ellipse(
                (self.cx - w * 1.02, neck_y - h * 0.020, self.cx + w * 1.02, neck_y + h * 0.045),
                fill=rgba(scarf_col),
            )
            self.draw.rounded_rectangle(
                (self.cx + w * 0.42, neck_y, self.cx + w * 0.72, neck_y + h * 0.17),
                radius=int(w * 0.13), fill=rgba(shade_col := mix(scarf_col, "#000000", 0.12)),
            )
            for k in range(4):
                self.draw.line(
                    (self.cx + w * 0.47, neck_y + h * 0.028 + k * h * 0.027,
                     self.cx + w * 0.68, neck_y + h * 0.020 + k * h * 0.027),
                    fill=rgba(mix(scarf_col, "#ffffff", 0.40)), width=int(SS * 1.5),
                )
        else:
            self.draw.arc(
                (self.cx - w * 0.55, top - h * 0.02, self.cx + w * 0.55, top + h * 0.085),
                10, 170, fill=rgba(mix(body_col, "#ffffff", 0.40)), width=int(SS * 2),
            )
        # center seam + tiny buttons
        self.draw.line(
            (self.cx, top + h * 0.07, self.cx, bottom - h * 0.04),
            fill=rgba(mix(body_col, "#000000", 0.10)), width=int(SS * 1.4),
        )
        for k in range(2):
            self.circle(self.cx + w * 0.33, top + h * 0.115 + k * h * 0.06, h * 0.008,
                        rgba(mix(self.outfit2, "#f8dfb0", 0.55), 220))
        # hem
        self.draw.arc(
            (self.cx - w * 0.86, bottom - h * 0.055, self.cx + w * 0.86, bottom + h * 0.025),
            15, 165, fill=rgba(mix(body_col, "#ffffff", 0.28)), width=int(SS * 2),
        )
        # snowflake brooch / tiny emblem
        emx, emy = self.cx - w * 0.35, top + h * 0.14
        er = h * 0.012
        for k in range(3):
            a = k * math.pi / 3
            self.draw.line((emx - math.cos(a) * er, emy - math.sin(a) * er,
                            emx + math.cos(a) * er, emy + math.sin(a) * er),
                           fill=rgba(self.series["theme"]["haze"], 170), width=max(1, int(SS)))

    def arm_points(self, side, up=False, forward=False):
        h = self.height
        shoulder = (self.cx + side * self.body_w * 0.96, self.body_top + h * 0.085)
        if up:
            elbow = (shoulder[0] + side * h * 0.090, shoulder[1] + h * 0.080)
            hand = (elbow[0] + side * h * 0.028, elbow[1] - h * 0.165)
        elif forward:
            elbow = (shoulder[0] + side * h * 0.045, shoulder[1] + h * 0.120)
            hand = (self.cx + side * h * 0.115, shoulder[1] + h * 0.170)
        else:
            elbow = (shoulder[0] + side * h * 0.052, shoulder[1] + h * 0.120)
            hand = (shoulder[0] + side * h * 0.030, shoulder[1] + h * 0.225)
        return shoulder, elbow, hand

    def draw_arms(self):
        h = self.height
        arm_w = h * 0.096
        for side in (-1, 1):
            up = (self.pose in ("one_up", "wave") and side > 0)
            forward = (self.pose in ("bauble", "hold") and side < 0)
            shoulder, elbow, hand = self.arm_points(side, up, forward)
            sleeve = self.outfit if self.rng.random() > 0.35 else mix(self.outfit, self.outfit2, 0.3)
            self.capsule(*shoulder, *elbow, int(arm_w), rgba(sleeve))
            self.capsule(*elbow, *hand, int(arm_w * 0.82), rgba(sleeve))
            # glove / hand
            self.circle(hand[0], hand[1], arm_w * 0.58, rgba(self.skin))
            self.draw.arc(
                (hand[0] - arm_w * 0.55, hand[1] - arm_w * 0.62,
                 hand[0] + arm_w * 0.55, hand[1] + arm_w * 0.30),
                185, 345, fill=rgba(mix(self.skin, "#ffffff", 0.44)), width=int(SS * 1.5),
            )
            # cuff
            self.draw.ellipse(
                (elbow[0] - arm_w * 0.56, elbow[1] - arm_w * 0.35,
                 elbow[0] + arm_w * 0.56, elbow[1] + arm_w * 0.40),
                fill=rgba(mix(sleeve, "#ffffff", 0.18)),
            )
        return self.arm_points(1, self.pose in ("one_up", "wave"), False)[2]

    # --- head --------------------------------------------------------------

    def draw_ears(self):
        r = self.head_r
        kind = self.series["ear"]
        skin = self.skin
        if kind == "long":
            for side in (-1, 1):
                tipx = self.cx + side * r * 0.72
                tipy = self.head_cy - r * 1.48
                basex = self.cx + side * r * 0.58
                basey = self.head_cy - r * 0.28
                w = r * 0.34
                self.draw.polygon(
                    [(basex - w * 0.5, basey), (tipx, tipy), (basex + w * 0.5, basey - r * 0.08)],
                    fill=rgba(mix(self.hair_col, "#b8966b", 0.30)),
                )
                self.draw.polygon(
                    [(basex - w * 0.22, basey - r * 0.08), (tipx, tipy + r * 0.20),
                     (basex + w * 0.20, basey - r * 0.10)],
                    fill=rgba(mix(self.series["palette"][0], self.skin, 0.55), 180),
                )
        elif kind == "longwhite":
            for side in (-1, 1):
                tipx = self.cx + side * r * 0.88
                tipy = self.head_cy - r * 1.33
                basex = self.cx + side * r * 0.56
                basey = self.head_cy - r * 0.18
                self.draw.polygon(
                    [(basex - r * 0.18, basey), (tipx, tipy), (basex + r * 0.19, basey - r * 0.05)],
                    fill=rgba(self.hair_col),
                )
                self.draw.line((basex, basey, tipx, tipy + r * 0.14),
                               fill=rgba(mix(self.hair_col, "#ffffff", 0.4), 90), width=int(SS * 2))
        elif kind == "pointed":
            for side in (-1, 1):
                self.draw.polygon(
                    [(self.cx + side * r * 0.62, self.head_cy - r * 0.25),
                     (self.cx + side * r * 1.08, self.head_cy - r * 0.74),
                     (self.cx + side * r * 0.92, self.head_cy + r * 0.18)],
                    fill=rgba(self.skin),
                )
        else:
            for side in (-1, 1):
                self.circle(self.cx + side * r * 0.94, self.head_cy + r * 0.02, r * 0.24,
                            rgba(self.skin))
                self.draw.arc(
                    (self.cx + side * r * 0.94 - r * 0.17, self.head_cy - r * 0.14,
                     self.cx + side * r * 0.94 + r * 0.17, self.head_cy + r * 0.19),
                    30 if side < 0 else 210, 150 if side < 0 else 330,
                    fill=rgba(mix(self.skin, "#ffffff", 0.35)), width=int(SS * 1.5),
                )

    def draw_hair_back(self):
        r = self.head_r
        style = self.series["hair_style"]
        col = self.hair_col
        if style in ("bob", "sleekbob"):
            extra = r * 0.22 if style == "bob" else r * 0.10
            self.draw.rounded_rectangle(
                (self.cx - r * (1.02 + extra / r), self.head_cy - r * 0.78,
                 self.cx + r * (1.02 + extra / r), self.head_cy + r * (0.78 if style == "bob" else 0.68)),
                radius=int(r * 0.55), fill=rgba(col),
            )
        elif style == "cloud":
            for _ in range(11):
                ang = self.rng.uniform(0, math.tau)
                rad = r * self.rng.uniform(0.70, 1.16)
                bx = self.cx + math.cos(ang) * rad * 0.95
                by = self.head_cy - r * 0.34 + math.sin(ang) * rad * 0.52
                self.circle(bx, by, r * self.rng.uniform(0.22, 0.40), rgba(col))
        elif style in ("fur", "furwhite"):
            for _ in range(20):
                ang = self.rng.uniform(0, math.tau)
                rad = r * self.rng.uniform(0.92, 1.22)
                bx = self.cx + math.cos(ang) * rad
                by = self.head_cy + math.sin(ang) * rad * 0.86
                self.circle(bx, by, r * self.rng.uniform(0.16, 0.28), rgba(col))
        elif style == "twintails":
            self.circle(self.cx - r * 1.12, self.head_cy + r * 0.28, r * 0.36, rgba(col))
            self.circle(self.cx + r * 1.12, self.head_cy + r * 0.28, r * 0.36, rgba(col))
            self.draw.ellipse((self.cx - r * 1.03, self.head_cy - r * 0.70,
                               self.cx + r * 1.03, self.head_cy + r * 0.73), fill=rgba(col))
        elif style == "curls":
            for _ in range(10):
                ang = self.rng.uniform(0, math.tau)
                bx = self.cx + math.cos(ang) * r * 1.02
                by = self.head_cy + math.sin(ang) * r * 0.70
                self.circle(bx, by, r * self.rng.uniform(0.22, 0.30), rgba(col))
        elif style == "messy":
            self.draw.ellipse((self.cx - r * 1.02, self.head_cy - r * 0.88,
                               self.cx + r * 1.02, self.head_cy + r * 0.45), fill=rgba(col))
            for _ in range(7):
                side = -1 if self.rng.random() < 0.5 else 1
                bx = self.cx + side * r * self.rng.uniform(0.55, 0.95)
                by = self.head_cy - r * self.rng.uniform(0.35, 0.80)
                self.draw.polygon(
                    [(bx, by), (bx + side * r * self.rng.uniform(0.2, 0.5), by - r * self.rng.uniform(0.15, 0.45)),
                     (bx + side * r * 0.14, by + r * 0.10)],
                    fill=rgba(col),
                )

    def draw_head(self):
        r = self.head_r
        # neck
        self.draw.rounded_rectangle(
            (self.cx - r * 0.18, self.head_cy + r * 0.75, self.cx + r * 0.18,
             self.body_top + r * 0.14),
            radius=int(r * 0.12), fill=rgba(shade_col := mix(self.skin, "#000000", 0.10)),
        )
        # face
        self.draw.ellipse(
            (self.cx - r, self.head_cy - r * 1.02, self.cx + r, self.head_cy + r * 0.97),
            fill=rgba(self.skin),
        )
        # ears in front of hair for some styles
        if self.series["ear"] == "round":
            self.draw_ears()
        # forehead highlight
        self.soft_ellipse(
            (self.cx - r * 0.58, self.head_cy - r * 0.86, self.cx + r * 0.18, self.head_cy - r * 0.25),
            mix(self.skin, "#ffffff", 0.55), 110, blur=SS * 8,
        )
        # cheek / chin shadow
        self.soft_ellipse(
            (self.cx - r * 0.58, self.head_cy + r * 0.43, self.cx + r * 0.58, self.head_cy + r * 0.92),
            mix(self.skin, "#9b6a5c", 0.55), 92, blur=SS * 9,
        )
        self.draw_hair_front()
        self.draw_face()
        self.draw_hat()

    def draw_hair_front(self):
        r = self.head_r
        style = self.series["hair_style"]
        col = self.hair_col
        if style in ("bob", "sleekbob"):
            # fringe
            self.draw.chord(
                (self.cx - r * 1.02, self.head_cy - r * 1.04,
                 self.cx + r * 1.02, self.head_cy + r * 0.08),
                180, 360, fill=rgba(col),
            )
            # side curtain locks
            for side in (-1, 1):
                x1 = self.cx - r * 0.98 if side < 0 else self.cx + r * 0.62
                x2 = self.cx - r * 0.62 if side < 0 else self.cx + r * 0.98
                self.draw.ellipse(
                    (x1, self.head_cy - r * 0.45, x2, self.head_cy + r * 0.72),
                    fill=rgba(col),
                )
        elif style == "cloud":
            for _ in range(7):
                bx = self.cx + self.rng.uniform(-0.72, 0.72) * r
                by = self.head_cy - r * self.rng.uniform(0.62, 1.02)
                self.circle(bx, by, r * self.rng.uniform(0.18, 0.31), rgba(col))
        elif style in ("fur", "furwhite"):
            # fur fringe across forehead
            for i in range(9):
                bx = self.cx + (i - 4) * r * 0.18
                by = self.head_cy - r * 0.76 + abs(i - 4) * r * 0.025
                self.circle(bx, by, r * 0.15, rgba(col))
        elif style == "twintails":
            self.draw.chord(
                (self.cx - r * 1.00, self.head_cy - r * 1.05,
                 self.cx + r * 1.00, self.head_cy - r * 0.02),
                180, 350, fill=rgba(col),
            )
            # silver streak
            self.draw.arc(
                (self.cx - r * 0.82, self.head_cy - r * 0.98,
                 self.cx + r * 0.82, self.head_cy - r * 0.03),
                205, 330, fill=rgba("#e8d8f1", 100), width=int(SS * 2),
            )
        elif style == "curls":
            for i in range(8):
                bx = self.cx + self.rng.uniform(-0.86, 0.86) * r
                by = self.head_cy - r * self.rng.uniform(0.55, 0.92)
                self.circle(bx, by, r * self.rng.uniform(0.16, 0.25), rgba(col))
            # bonnet
            self.draw.arc(
                (self.cx - r * 1.06, self.head_cy - r * 1.12,
                 self.cx + r * 1.06, self.head_cy + r * 0.14),
                178, 362, fill=rgba(mix(self.series["palette"][0], "#ffffff", 0.34)),
                width=int(SS * 4),
            )
        elif style == "messy":
            for i in range(9):
                bx = self.cx + self.rng.uniform(-0.85, 0.85) * r
                by = self.head_cy - r * self.rng.uniform(0.58, 0.92)
                self.circle(bx, by, r * self.rng.uniform(0.12, 0.23), rgba(col))
        elif style in ("beanie", "elfhat"):
            # hat details are drawn later; small fringe
            self.draw.chord(
                (self.cx - r * 0.95, self.head_cy - r * 0.88,
                 self.cx + r * 0.95, self.head_cy + r * 0.02),
                190, 350, fill=rgba(col),
            )

    def draw_face(self):
        r = self.head_r
        ey = self.head_cy + r * 0.12
        ex = r * 0.37
        style = self.series["eye_style"]
        for side in (-1, 1):
            x = self.cx + side * ex
            if style == "sleepy":
                self.draw.arc((x - r * 0.16, ey - r * 0.08, x + r * 0.16, ey + r * 0.09),
                              195, 345, fill=rgba(self.eye_col, 230), width=int(SS * 3))
                self.draw.arc((x - r * 0.12, ey - r * 0.13, x + r * 0.12, ey + r * 0.02),
                              205, 335, fill=rgba(mix(self.eye_col, "#ffffff", 0.6), 50), width=int(SS))
            elif style == "grin":
                self.draw.ellipse((x - r * 0.14, ey - r * 0.14, x + r * 0.14, ey + r * 0.14),
                                  fill=rgba(self.eye_col), outline=rgba(mix(self.eye_col, "#ffffff", 0.35), 80), width=int(SS))
                self.circle(x - side * r * 0.04, ey - r * 0.045, r * 0.045, rgba("#fff9eb", 230))
            elif style == "teary":
                self.draw.ellipse((x - r * 0.16, ey - r * 0.17, x + r * 0.16, ey + r * 0.20),
                                  fill=rgba(self.eye_col))
                self.circle(x - side * r * 0.045, ey - r * 0.055, r * 0.055, rgba("#fff7ed", 235))
                self.circle(x + side * r * 0.035, ey + r * 0.085, r * 0.020, rgba("#ffffff", 210))
                # tear
                if side == 1:
                    self.draw.ellipse((x + r * 0.02, ey + r * 0.16, x + r * 0.09, ey + r * 0.28),
                                      fill=rgba("#d9f2ff", 200))
            elif style == "gothic":
                self.draw.ellipse((x - r * 0.19, ey - r * 0.16, x + r * 0.19, ey + r * 0.19),
                                  fill=rgba(mix(self.eye_col, "#1a0c1f", 0.55)))
                self.draw.arc((x - r * 0.22, ey - r * 0.20, x + r * 0.22, ey + r * 0.22),
                              15, 165, fill=rgba("#2a122f", 240), width=int(SS * 2))
                self.circle(x - side * r * 0.05, ey - r * 0.045, r * 0.05, rgba("#f2e7ff", 230))
                self.draw.line((x - side * r * 0.14, ey + r * 0.25, x - side * r * 0.02, ey + r * 0.31),
                               fill=rgba("#9f7db4", 120), width=int(SS * 1.5))
            elif style == "serious":
                self.draw.ellipse((x - r * 0.13, ey - r * 0.12, x + r * 0.13, ey + r * 0.13),
                                  fill=rgba(self.eye_col))
                self.draw.line((x - r * 0.17, ey - r * 0.20, x + r * 0.16, ey - r * 0.16),
                               fill=rgba(self.hair_col, 160), width=int(SS * 1.8))
                self.circle(x - side * r * 0.04, ey - r * 0.045, r * 0.035, rgba("#fff7eb", 225))
            elif style == "star":
                self.draw.ellipse((x - r * 0.16, ey - r * 0.17, x + r * 0.16, ey + r * 0.18),
                                  fill=rgba(self.eye_col))
                span = r * 0.12
                for k in range(3):
                    a = k * math.pi / 3
                    self.draw.line((x - math.cos(a) * span, ey - math.sin(a) * span,
                                    x + math.cos(a) * span, ey + math.sin(a) * span),
                                   fill=rgba("#f5efff", 195), width=int(SS))
                self.circle(x - side * r * 0.05, ey - r * 0.06, r * 0.045, rgba("#ffffff", 220))
            elif style == "wide":
                self.draw.ellipse((x - r * 0.17, ey - r * 0.18, x + r * 0.17, ey + r * 0.19),
                                  fill=rgba(self.eye_col))
                self.circle(x - side * r * 0.05, ey - r * 0.055, r * 0.055, rgba("#ffffff", 230))
                self.circle(x + side * r * 0.07, ey + r * 0.07, r * 0.023, rgba("#ffffff", 160))
            elif style == "pout":
                self.draw.ellipse((x - r * 0.17, ey - r * 0.18, x + r * 0.17, ey + r * 0.19),
                                  fill=rgba(self.eye_col))
                self.circle(x - side * r * 0.05, ey - r * 0.055, r * 0.055, rgba("#fff8ed", 235))
                self.circle(x + side * r * 0.055, ey + r * 0.08, r * 0.022, rgba("#ffffff", 150))
            else:  # dreamy
                self.draw.arc((x - r * 0.17, ey - r * 0.14, x + r * 0.17, ey + r * 0.16),
                              185, 355, fill=rgba(self.eye_col, 230), width=int(SS * 2.5))
                self.circle(x + side * r * 0.04, ey - r * 0.02, r * 0.035, rgba("#ffffff", 210))

        # eyebrows
        if style not in ("sleepy",):
            for side in (-1, 1):
                x = self.cx + side * ex
                self.draw.arc((x - r * 0.13, ey - r * 0.36, x + r * 0.13, ey - r * 0.16),
                              205, 335, fill=rgba(mix(self.hair_col, "#5e3e35", 0.35)),
                              width=int(SS * 1.2))
        # nose
        self.soft_ellipse((self.cx - r * 0.028, ey + r * 0.20, self.cx + r * 0.028, ey + r * 0.25),
                          mix(self.skin, "#8f5e50", 0.55), 120, blur=SS * 1.2)
        # blush
        for side in (-1, 1):
            blush = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
            bd = ImageDraw.Draw(blush)
            x = self.cx + side * r * 0.56
            bd.ellipse((x - r * 0.19, ey + r * 0.20, x + r * 0.19, ey + r * 0.37),
                       fill=rgba(mix(self.lip, "#ffb2b2", 0.5), 44))
            blush = blush.filter(ImageFilter.GaussianBlur(r * 0.06))
            self.img.alpha_composite(blush)
        # mouth
        my = ey + r * 0.35
        if style == "grin":
            self.draw.arc((self.cx - r * 0.16, my - r * 0.06, self.cx + r * 0.16, my + r * 0.13),
                          10, 170, fill=rgba(self.lip, 235), width=int(SS * 2.5))
            self.draw.chord((self.cx - r * 0.15, my - r * 0.02, self.cx + r * 0.15, my + r * 0.12),
                            0, 180, fill=rgba("#fdf4e5", 210))
        elif style == "smile":
            self.draw.arc((self.cx - r * 0.16, my - r * 0.04, self.cx + r * 0.16, my + r * 0.13),
                          12, 168, fill=rgba(self.lip, 230), width=int(SS * 2.4))
        elif style == "pout":
            self.draw.ellipse((self.cx - r * 0.06, my - r * 0.01, self.cx + r * 0.06, my + r * 0.06),
                              fill=rgba(self.lip))
            self.draw.ellipse((self.cx - r * 0.025, my + r * 0.005, self.cx + r * 0.025, my + r * 0.025),
                              fill=rgba(mix(self.lip, "#ffffff", 0.45)))
        else:
            self.draw.arc((self.cx - r * 0.13, my - r * 0.03, self.cx + r * 0.13, my + r * 0.09),
                          18, 162, fill=rgba(self.lip, 210), width=int(SS * 2))
        # freckles for some
        if self.rng.random() < 0.30:
            for side in (-1, 1):
                for k in range(3):
                    self.circle(self.cx + side * r * (0.33 + k * 0.045), ey + r * (0.28 + (k % 2) * 0.03),
                                r * 0.008, rgba(mix(self.skin, "#9c6a54", 0.4)))

    def draw_hat(self):
        r = self.head_r
        if self.hat == "santa":
            col = "#b52f45"
            self.draw.polygon(
                [(self.cx - r * 0.55, self.head_cy - r * 0.82),
                 (self.cx + r * 0.32, self.head_cy - r * 1.82),
                 (self.cx + r * 0.90, self.head_cy - r * 0.79)],
                fill=rgba(col),
            )
            self.circle(self.cx + r * 0.34, self.head_cy - r * 1.78, r * 0.15, rgba("#f8ead6"))
            self.draw.arc((self.cx - r * 1.03, self.head_cy - r * 1.02,
                           self.cx + r * 1.03, self.head_cy - r * 0.54),
                          180, 360, fill=rgba("#f5e3cf"), width=int(SS * 7))
        elif self.hat == "antlers":
            for side in (-1, 1):
                bx = self.cx + side * r * 0.64
                by = self.head_cy - r * 0.82
                stem = [(bx, by), (bx + side * r * 0.22, by - r * 0.58)]
                self.draw.line(stem, fill=rgba("#b99a6c"), width=int(SS * 3.5))
                for sign in (-1, 1):
                    self.draw.line(
                        (bx + side * r * 0.15, by - r * 0.35,
                         bx + side * r * 0.15 + sign * r * 0.20, by - r * 0.60),
                        fill=rgba("#b99a6c"), width=int(SS * 3.0),
                    )
                self.draw.line(
                    (bx + side * r * 0.22, by - r * 0.58,
                     bx + side * r * 0.43, by - r * 0.78),
                    fill=rgba("#b99a6c"), width=int(SS * 2.6),
                )
            self.draw.arc((self.cx - r * 0.86, self.head_cy - r * 0.86,
                           self.cx + r * 0.86, self.head_cy - r * 0.62),
                          185, 355, fill=rgba("#9d7d59"), width=int(SS * 3))
        elif self.hat == "earmuff":
            for side in (-1, 1):
                self.draw.arc(
                    (self.cx + side * r * 0.58 - r * 0.28, self.head_cy - r * 0.74,
                     self.cx + side * r * 0.58 + r * 0.28, self.head_cy - r * 0.12),
                    0 if side > 0 else 180, 180 if side > 0 else 360,
                    fill=rgba(mix(self.series["palette"][0], "#ffffff", 0.25)),
                    width=int(SS * 8),
                )
            self.draw.arc((self.cx - r * 0.78, self.head_cy - r * 1.10,
                           self.cx + r * 0.78, self.head_cy - r * 0.58),
                          185, 355, fill=rgba(mix(self.series["palette"][0], "#ffffff", 0.18)),
                          width=int(SS * 5))
        elif self.hat == "starclip":
            for side in (-1, 1):
                sx = self.cx + side * r * 0.74
                sy = self.head_cy - r * 0.78
                self.draw_star(sx, sy, r * 0.17, rgba("#f6d49a"), 5)
                self.circle(sx, sy, r * 0.04, rgba("#fff8e8"))
        elif self.hat == "crown":
            base_y = self.head_cy - r * 0.98
            self.draw.polygon(
                [(self.cx - r * 0.46, base_y), (self.cx - r * 0.47, base_y - r * 0.35),
                 (self.cx - r * 0.20, base_y - r * 0.12), (self.cx, base_y - r * 0.50),
                 (self.cx + r * 0.20, base_y - r * 0.12), (self.cx + r * 0.47, base_y - r * 0.35),
                 (self.cx + r * 0.46, base_y)],
                fill=rgba("#d8b46f"),
            )
            for k in (-1, 0, 1):
                self.circle(self.cx + k * r * 0.29, base_y - r * 0.08, r * 0.035, rgba("#fff4d4"))
        elif self.hat == "beanie":
            beanie_col = mix(self.outfit, "#f3e6d1", 0.35)
            self.draw.chord(
                (self.cx - r * 1.08, self.head_cy - r * 1.30,
                 self.cx + r * 1.08, self.head_cy - r * 0.24),
                180, 360, fill=rgba(beanie_col),
            )
            self.draw.rounded_rectangle(
                (self.cx - r * 1.08, self.head_cy - r * 0.78,
                 self.cx + r * 1.08, self.head_cy - r * 0.56),
                radius=int(r * 0.12), fill=rgba(mix(beanie_col, "#ffffff", 0.12)),
            )
            for k in range(9):
                self.draw.line((self.cx - r * 0.95 + k * r * 0.24, self.head_cy - r * 1.24,
                                self.cx - r * 0.95 + k * r * 0.24, self.head_cy - r * 0.82),
                               fill=rgba(mix(beanie_col, "#9e6b4e", 0.3), 40), width=int(SS))
            self.circle(self.cx + r * 0.02, self.head_cy - r * 1.35, r * 0.13, rgba("#f7e6ca"))
        elif self.hat == "elfhat":
            hat_col = mix(self.outfit2, self.series["theme"]["glow"], 0.18)
            self.draw.polygon(
                [(self.cx - r * 0.92, self.head_cy - r * 0.80),
                 (self.cx + r * 0.28, self.head_cy - r * 1.92),
                 (self.cx + r * 0.92, self.head_cy - r * 0.78)],
                fill=rgba(hat_col),
            )
            self.draw.arc((self.cx - r * 0.99, self.head_cy - r * 0.93,
                           self.cx + r * 0.99, self.head_cy - r * 0.62),
                          190, 350, fill=rgba(mix(hat_col, "#ffffff", 0.20)), width=int(SS * 5))
            self.circle(self.cx + r * 0.27, self.head_cy - r * 1.88, r * 0.10, rgba("#f6e5bf"))

    def draw_star(self, x, y, r, fill, points=5):
        pts = []
        for i in range(points * 2):
            a = -math.pi / 2 + i * math.pi / points
            rad = r if i % 2 == 0 else r * 0.43
            pts.append((x + math.cos(a) * rad, y + math.sin(a) * rad))
        self.draw.polygon(pts, fill=fill)

    def draw_prop(self, hand):
        r = self.head_r
        h = self.height
        x, y = hand
        if self.pose in ("arms_down", "wave"):
            x = self.cx + self.body_w * 1.00
            y = self.body_bottom - h * 0.10
        if self.prop == "bauble":
            rad = h * 0.085
            self.circle(x, y - rad * 0.25, rad, rgba(mix(self.series["theme"]["glow"], "#ffffff", 0.10)))
            self.circle(x - rad * 0.30, y - rad * 0.55, rad * 0.18, rgba("#ffffff", 110))
            self.draw.rectangle((x - rad * 0.14, y - rad * 1.38, x + rad * 0.14, y - rad * 1.04),
                                fill=rgba("#d9ba82"))
            self.draw.arc((x - rad * 0.44, y - rad * 1.60, x + rad * 0.44, y - rad * 0.88),
                          200, 340, fill=rgba("#d9ba82"), width=int(SS * 2))
        elif self.prop == "candy":
            top = (x + r * 0.10, y - h * 0.26)
            self.draw.line((x, y, *top), fill=rgba("#f3e8d9"), width=int(h * 0.018))
            for k in range(9):
                self.draw.line(
                    (x + (top[0] - x) * k / 9, y - h * 0.26 * k / 9,
                     x + (top[0] - x) * k / 9 + h * 0.014, y - h * 0.26 * k / 9),
                    fill=rgba("#c9555d"), width=int(h * 0.018),
                )
            self.draw.arc((top[0] - h * 0.045, top[1] - h * 0.055,
                           top[0] + h * 0.045, top[1] + h * 0.045),
                          90, 450, fill=rgba("#f3e8d9"), width=int(h * 0.020))
        elif self.prop == "star":
            self.draw.line((x, y, x + r * 0.10, y - h * 0.20),
                           fill=rgba("#d8b46f"), width=int(SS * 3))
            self.draw_star(x + r * 0.12, y - h * 0.23, h * 0.055, rgba("#f2d49b"))
        elif self.prop == "gift":
            bw, bh = h * 0.14, h * 0.10
            self.draw.rounded_rectangle((x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2),
                                        radius=int(bh * 0.15), fill=rgba(mix(self.outfit2, "#2e1a16", 0.25)))
            self.draw.rectangle((x - bw * 0.06, y - bh / 2, x + bw * 0.06, y + bh / 2), fill=rgba("#d9b46f"))
            self.draw.rectangle((x - bw / 2, y - bh * 0.08, x + bw / 2, y + bh * 0.06), fill=rgba("#d9b46f"))
            for sign in (-1, 1):
                self.draw.arc((x - bw * 0.22 + sign * bw * 0.07, y - bh * 0.64,
                               x + bw * 0.10 + sign * bw * 0.07, y - bh * 0.40),
                              180, 360, fill=rgba("#d9b46f"), width=int(SS * 3))
        elif self.prop == "candle":
            cw, ch = h * 0.045, h * 0.11
            self.draw.rounded_rectangle((x - cw / 2, y - ch, x + cw / 2, y + ch * 0.25),
                                        radius=int(cw * 0.18), fill=rgba("#f0e2c7"))
            self.draw.ellipse((x - cw * 0.34, y - ch * 0.98, x + cw * 0.34, y - ch * 0.80),
                              fill=rgba("#eddcc1"))
            flame = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
            fd = ImageDraw.Draw(flame)
            fd.ellipse((x - cw * 0.7, y - ch * 1.58, x + cw * 0.7, y - ch * 0.96),
                       fill=rgba("#ffd28b", 220))
            flame = flame.filter(ImageFilter.GaussianBlur(8 * SS))
            self.img.alpha_composite(flame)
            self.draw.ellipse((x - cw * 0.20, y - ch * 1.40, x + cw * 0.20, y - ch * 1.04),
                              fill=rgba("#fff2ce", 235))
        elif self.prop == "tree":
            tw = h * 0.15
            base = y + h * 0.03
            for k in range(3):
                seg_w = tw * (1 - k * 0.24)
                top = base - h * (0.04 + k * 0.05)
                bottom = base - h * (0.00 + k * 0.05)
                self.draw.polygon([(x - seg_w / 2, bottom), (x, top), (x + seg_w / 2, bottom)],
                                  fill=rgba(mix("#2f5944", self.series["theme"]["glow"], 0.05)))
            self.draw.rectangle((x - tw * 0.06, base, x + tw * 0.06, base + h * 0.035),
                                fill=rgba("#6d4b32"))
            for k in range(6):
                self.circle(x + self.rng.uniform(-0.35, 0.35) * tw, base - h * self.rng.uniform(0.02, 0.14),
                            h * 0.006, rgba("#ffd7a0", 210))
        elif self.prop == "letter":
            ww, hh = h * 0.13, h * 0.09
            self.draw.rounded_rectangle((x - ww / 2, y - hh / 2, x + ww / 2, y + hh / 2),
                                        radius=int(hh * 0.08), fill=rgba("#f0dfc3"))
            self.draw.line((x - ww / 2, y - hh / 2, x, y + hh * 0.10), fill=rgba("#b89571"), width=int(SS * 2))
            self.draw.line((x + ww / 2, y - hh / 2, x, y + hh * 0.10), fill=rgba("#b89571"), width=int(SS * 2))
            self.circle(x, y + hh * 0.32, h * 0.02, rgba("#b4454f"))
        elif self.prop == "globe":
            rad = h * 0.08
            self.circle(x, y - rad * 0.55, rad, rgba("#b8e6ed", 105))
            self.circle(x, y - rad * 0.55, rad, outline=rgba("#e6cfac"), width=int(SS * 2))
            self.draw.arc((x - rad * 0.9, y - rad * 0.20, x + rad * 0.9, y + rad * 1.20),
                          190, 350, fill=rgba("#d9bb86"), width=int(SS * 4))
            for k in range(5):
                self.circle(x + self.rng.uniform(-0.7, 0.7) * rad, y - rad * self.rng.uniform(0.3, 1.2),
                            h * 0.006, rgba("#ffffff", 180))
        elif self.prop == "bell":
            bw = h * 0.06
            self.draw.chord((x - bw, y - bw * 1.9, x + bw, y + bw * 0.85),
                            180, 360, fill=rgba("#d9b46f"))
            self.draw.rectangle((x - bw * 0.82, y - bw * 0.74, x + bw * 0.82, y - bw * 0.52),
                                fill=rgba(mix("#d9b46f", "#7e5b33", 0.2)))
            self.circle(x, y + bw * 0.20, bw * 0.20, rgba("#8c6234"))
            self.draw.arc((x - bw * 0.30, y - bw * 2.18, x + bw * 0.30, y - bw * 1.62),
                          200, 340, fill=rgba("#d9b46f"), width=int(SS * 2))

    # --- finishing ---------------------------------------------------------

    def finish(self, base: Image.Image) -> Image.Image:
        mask = self.img.getchannel("A")
        # global studio highlight from the upper left
        hl = radial_overlay(CW, CH, (self.cx - self.head_r * 1.4, self.head_cy - self.head_r * 1.2),
                            self.height * 0.48, "#ffffff", 0.45, (1.0, 1.15))
        clipped = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        clipped.paste(hl, (0, 0), ImageChops.multiply(hl.getchannel("A"), mask))
        lit = screen_layer(self.img, clipped)
        # keep figure alpha
        lit.putalpha(mask)

        # cool rim light from the right
        rim = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        rd = ImageDraw.Draw(rim)
        rd.arc(
            (self.cx - self.head_r * 1.10, self.head_cy - self.head_r * 1.12,
             self.cx + self.head_r * 1.10, self.head_cy + self.head_r * 1.07),
            285, 55, fill=rgba(self.series["theme"]["glow"], 115), width=int(SS * 3.4),
        )
        rim = rim.filter(ImageFilter.GaussianBlur(SS * 1.6))
        rim_clipped = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        rim_clipped.paste(rim, (0, 0), ImageChops.multiply(rim.getchannel("A"), mask))
        lit = Image.alpha_composite(lit, rim_clipped)

        # film-y chromatic warmth in highlights
        warm = Image.new("RGBA", self.img.size, rgba(self.series["theme"]["haze"], 18))
        lit = Image.alpha_composite(lit, Image.composite(warm, Image.new("RGBA", lit.size, (0, 0, 0, 0)),
                                                        ImageChops.multiply(mask, mask)))

        # A polished acrylic plinth would throw a faint, glossy reflection.
        bbox = lit.getbbox()
        out = base.copy()
        if bbox:
            figure_layer = lit.crop(bbox)
            refl = figure_layer.transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert("RGBA")
            fade = Image.new("L", refl.size, 0)
            fd = ImageDraw.Draw(fade)
            for yy in range(refl.height):
                fd.line((0, yy, refl.width, yy), fill=int(54 * (1 - yy / max(1, refl.height)) ** 2))
            refl.putalpha(ImageChops.multiply(refl.getchannel("A"), fade))
            refl = refl.filter(ImageFilter.GaussianBlur(5 * SS))
            out.alpha_composite(refl, (bbox[0], int(self.base_y + self.height * 0.015)))

        out.alpha_composite(lit)
        return out.convert("RGB")


# ---------------------------------------------------------------------------
# Plate rendering
# ---------------------------------------------------------------------------

def foreground_bokeh(img: Image.Image, seed: int, theme: dict) -> Image.Image:
    rng = random.Random(seed + 991)
    layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(14):
        x = rng.uniform(-0.1, 1.1) * CW
        y = rng.uniform(0.55, 1.02) * CH
        r = rng.uniform(0.012, 0.060) * CW
        alpha = rng.randint(5, 24)
        d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(theme["haze"], alpha))
        d.ellipse((x - r * 0.98, y - r * 0.98, x + r * 0.98, y + r * 0.98),
                  outline=rgba(theme["accent"], alpha + 8), width=1)
    return layer.filter(ImageFilter.GaussianBlur(11))


def dust_and_stars(img: Image.Image, seed: int, theme: dict) -> Image.Image:
    rng = random.Random(seed + 2026)
    layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(95):
        x, y = rng.uniform(0, CW), rng.uniform(0, CH)
        r = rng.choice([0.7, 1.0, 1.3, 1.8, 2.4]) * SS
        alpha = rng.randint(35, 160)
        d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(theme["haze"], alpha))
        if rng.random() < 0.15:
            d.line((x - r * 3.6, y, x + r * 3.6, y), fill=rgba(theme["haze"], alpha // 2), width=1)
            d.line((x, y - r * 3.6, x, y + r * 3.6), fill=rgba(theme["haze"], alpha // 2), width=1)
    # snowflakes
    for _ in range(24):
        x, y = rng.uniform(0, CW), rng.uniform(0, CH)
        r = rng.uniform(1.2, 3.8) * SS
        alpha = rng.randint(22, 80)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 249, 238, alpha))
    return layer


def render_plate(index: int, series: dict, variant: int, seed: int) -> tuple[Image.Image, dict]:
    rng = random.Random(seed)
    # Per-plate colour variants keep twenty pieces of the same character from
    # looking like twenty copies of one render.
    series = dict(series)
    accent = series["palette"][index % len(series["palette"])]
    series["outfit"] = mix(series["outfit"], accent, rng.uniform(0.12, 0.38))
    series["outfit2"] = mix(series["outfit2"], series["theme"]["glow"], rng.uniform(0.0, 0.16))
    series["skin"] = mix(series["skin"], "#f7e5d3", rng.uniform(0.0, 0.10))
    base = make_background(seed, series, variant)
    figure = Figure(base, seed + 17, series)
    figure.draw_shadow()
    figure.draw_legs()
    figure.draw_body()
    hand = figure.draw_arms()
    figure.draw_hair_back()
    figure.draw_head()
    figure.draw_ears() if series["ear"] != "round" else None
    figure.draw_prop(hand)

    comp = figure.finish(base)
    comp = Image.alpha_composite(comp.convert("RGBA"), foreground_bokeh(comp, seed, series["theme"]))
    comp = Image.alpha_composite(comp, dust_and_stars(comp, seed, series["theme"]))
    comp = comp.convert("RGB")
    comp = vignette(comp, 0.58)
    comp = add_grain(comp, seed, 6.5)

    # final down-sample
    full = comp.resize((W, H), Image.Resampling.LANCZOS)
    thumb = full.resize((300, 375), Image.Resampling.LANCZOS)
    return full, thumb


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def make_item(index: int) -> dict:
    s_index = index // 20
    n = index % 20
    series = SERIES[s_index]
    seed = 20261225 + index * 7919
    rng = random.Random(seed)

    variant = rng.randrange(4)
    hidden = index in (44, 87, 132, 176, 199)  # five hidden plates
    limited = (n + s_index) % 7 == 3
    rarity = "隐藏款" if hidden else ("限定款" if limited else "常规款")
    date_day = 1 + ((index * 7 + s_index * 3) % 28)
    date_month = 11 - ((index * 5 + s_index) % 3)
    date_year = 2026 if index > 17 else 2025
    acc = shift_sat(series["palette"][n % len(series["palette"])],
                    lightness=rng.uniform(-0.06, 0.05),
                    saturation=rng.uniform(0.92, 1.10),
                    hue=rng.uniform(-0.012, 0.012))
    story = series["story"][n % len(series["story"])]
    if hidden:
        story = QUOTES_HIDDEN[index % len(QUOTES_HIDDEN)]
    confidence = round(0.948 + rng.random() * 0.051, 3)
    item = {
        "id": f"PM-2026-{index + 1:03d}",
        "no": f"{index + 1:03d}",
        "seriesKey": series["key"],
        "series": series["name"],
        "seriesCn": series["cn"],
        "collection": series["collection"],
        "collectionEn": series["collectionEn"],
        "character": series["name"],
        "title": series["titles"][n],
        "titleEn": series["titles_en"][n],
        "story": story,
        "rarity": rarity,
        "date": f"{date_year}.{date_month:02d}.{date_day:02d}",
        "accent": acc,
        "confidence": confidence,
        "sample": True,
        "thumb": f"assets/photos/thumb/{index + 1:03d}.webp",
        "src": f"assets/photos/full/{index + 1:03d}.webp",
    }
    return item


def contact_sheet(images: list[Image.Image], out: Path, cols=5, cell=(216, 270)):
    rows = math.ceil(len(images) / cols)
    canvas = Image.new("RGB", (cols * cell[0], rows * cell[1]), "#10070a")
    for i, im in enumerate(images):
        im = im.resize(cell, Image.Resampling.LANCZOS)
        x = (i % cols) * cell[0]
        y = (i // cols) * cell[1]
        canvas.paste(im, (x, y))
    canvas.save(out, quality=88)


def main(limit: int | None = None, start: int = 0):
    FULL_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    end = min(200, start + (limit if limit else 200))
    items = []
    previews = []
    for index in range(start, end):
        series = SERIES[index // 20]
        seed = 20261225 + index * 7919
        full, thumb = render_plate(index, series, index % 4, seed)
        item = make_item(index)
        full.save(FULL_DIR / f"{index + 1:03d}.webp", "WEBP", quality=88, method=5)
        thumb.save(THUMB_DIR / f"{index + 1:03d}.webp", "WEBP", quality=82, method=5)
        items.append(item)
        if len(previews) < 20:
            previews.append(full.copy())
        print(f"  · plate {index + 1:03d}/200  {series['name']}  {item['title']}", flush=True)

    if end - start <= 20:
        contact_sheet(previews, PREVIEW_DIR / "contact-sheet.jpg", cols=5, cell=(216, 270))
        print(f"Preview contact sheet: {PREVIEW_DIR / 'contact-sheet.jpg'}")
        return

    # Full dataset JS, global for file-friendly loading.
    doc = (
        "/* STELLAR ARCHIVE — generated sample catalogue. Replace with your own photos in the Atelier. */\n"
        "window.STELLAR_DATA = "
        + json.dumps(items, ensure_ascii=False, indent=2)
        + ";\n"
    )
    DATA_FILE.write_text(doc, encoding="utf-8")
    contact_sheet(previews, PREVIEW_DIR / "contact-sheet.jpg", cols=5, cell=(216, 270))
    print(f"Wrote {len(items)} items -> {DATA_FILE}")
    print(f"Contact sheet -> {PREVIEW_DIR / 'contact-sheet.jpg'}")


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    main(limit, start)
