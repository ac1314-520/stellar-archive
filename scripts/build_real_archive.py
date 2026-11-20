"""Build the private JINGJING collection from the original photo folder.

Usage:
    python scripts/build_real_archive.py

The source folder can be changed with COLLECTION_SRC. The script:
  * reads IP / series / character from every named image;
  * classifies the collection by series;
  * creates black-gold archival mats around every photo;
  * writes full / card / thumb WebP assets and collection-data.js / series.js.

It is intentionally repeatable: add more named photos, run it again, and the
whole catalogue is rebuilt with stable independent numbers.
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
from collections import OrderedDict, defaultdict
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

try:
    import numpy as np
except Exception:  # pragma: no cover - Pillow-only fallback
    np = None

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(os.environ.get("COLLECTION_SRC", r"E:\deepseek工作区\泡泡玛特藏品"))
ASSETS = ROOT / "assets" / "photos"
SERIES_JS = ROOT / "js" / "series.js"
DATA_JS = ROOT / "js" / "collection-data.js"
MANIFEST = ROOT / "scripts" / "real-items.json"

FULL_SIZE = (1200, 1500)
CARD_SIZE = (600, 750)
THUMB_SIZE = (300, 375)
MAT = (100, 125, 1100, 1375)  # left, top, right, bottom
INNER = (1000, 1250)
ASSET_VERSION = os.environ.get("ASSET_VERSION", "20261120g")
ASSET_SUFFIX = f"?v={ASSET_VERSION}"
NUMBERING = ROOT / "scripts" / "collection-numbering.json"

IP_PREFIXES = [
    ("THE MONSTERS", "LABUBU"),
    ("SKULLPANDA", "SKULLPANDA"),
    ("Crybaby", "CRYBABY"),
    ("DIMOO", "DIMOO"),
    ("HACIPUPU", "HACIPUPU"),
    ("HACI", "HACIPUPU"),
    ("Labubu", "LABUBU"),
    ("Zsiga", "ZSIGA"),
    ("小甜豆", "SWEET BEAN"),
    ("星星人", "TWINKLE TWINKLE"),
]

IP_CN = {
    "CRYBABY": "哭娃",
    "DIMOO": "迪穆",
    "HACIPUPU": "哈奇噗噗",
    "LABUBU": "拉布布",
    "SKULLPANDA": "骷髅熊猫",
    "TWINKLE TWINKLE": "星星人",
    "ZSIGA": "兹西加",
    "SWEET BEAN": "甜豆",
}

# Series definition order = catalogue order. Each entry is keyed by
# (IP, normalized series name). New source folders can introduce new series;
# unknown groups receive a sensible fallback definition.
SERIES_DEFS = [
    # key, ip, series_cn, series_en, accent, intro
    ("crybaby-vacation", "CRYBABY", "Vacation Mode On系列", "VACATION MODE ON", "#e4a8b5", "把假日折进行李，带着一点想哭的快乐出发。"),
    ("crybaby-wish", "CRYBABY", "心愿达成系列", "WISH COME TRUE", "#e2b0be", "每一顶帽子、每一颗糖，都是愿望正在实现的证据。"),
    ("dimoo-pixar", "DIMOO", "PIXAR联名系列", "PIXAR", "#9dcddf", "当云朵旅人走进皮克斯的光影，故事就有了新的入口。"),
    ("dimoo-newborn", "DIMOO", "新生日记系列", "NEWBORN DIARY", "#c6c9df", "关于第一次看见世界，也关于被世界轻轻接住。"),
    ("dimoo-disney", "DIMOO", "迪士尼联名系列", "DISNEY", "#e2b77e", "米奇大街的午后、气球与旧房子，都收进同一本手账。"),
    ("dimoo-throttle", "DIMOO", "马力全开系列", "FULL THROTTLE", "#cbb28b", "把游戏手柄当缰绳，赢下今天最后一局。"),
    ("hacipupu-lostpaws", "HACIPUPU", "迷路汪汪系列", "LOST PAWS", "#c0b1d8", "耳朵先听见风，脚再慢慢找到回家的路。"),
    ("hacipupu-secretstory", "HACIPUPU", "秘境物语系列", "SECRET STORY", "#c7b5d8", "把梦藏进云里，再交给守夜的人。"),
    ("hacipupu-animals", "HACIPUPU", "动物贴贴系列", "ANIMAL HUGS", "#e2b8c5", "把小动物穿在身上，也把温柔贴在心上。"),
    ("labubu-coke", "LABUBU", "可口可乐系列", "COCA-COLA", "#c85b52", "气泡升起时，森林也开了一瓶冰镇夏天。"),
    ("labubu-cat", "LABUBU", "一喵变猫系列", "CAT MODE", "#b9ab9d", "披上猫的外套，学会在屋顶上无声地走。"),
    ("labubu-voltage", "LABUBU", "前方高能系列", "HIGH VOLTAGE", "#d7c68e", "六种情绪各自出发，在森林深处碰头。"),
    ("labubu-seated", "LABUBU", "坐坐派对搪胶毛绒系列", "SEATED PARTY", "#b8b1a4", "兜帽压低，音乐响起，坐在一起就是派对。"),
    ("labubu-macaron", "LABUBU", "心动马卡龙系列", "MACARON HEART", "#e8b7c7", "把甜点做成颜色，把心跳藏进糖霜。"),
    ("labubu-chess", "LABUBU", "象棋大冒险系列", "CHESS ADVENTURE", "#c9a96e", "棋盘铺开，森林里的小皇后准备落子。"),
    ("labubu-convenience", "LABUBU", "怪味便利店系列", "ODD CONVENIENCE", "#b9c28e", "货架上摆着奇怪的口味，也摆着一点日常的顽皮。"),
    ("labubu-onepiece", "LABUBU", "航海王系列", "ONE PIECE", "#d4a05e", "把草帽戴正，向伟大航路出发。"),
    ("monsters-barbershop", "LABUBU", "复古理发店系列", "BARBERSHOP", "#c9a592", "旧镜子、丝绒椅和一点反叛，理发店下午三点开门。"),
    ("monsters-summer", "LABUBU", "晒晒夏日系列", "SUMMER", "#e4b8c5", "把夏天晒得蓬松，再系上一根粉色缎带。"),
    ("monsters-sanrio", "LABUBU", "三丽鸥家族系列", "SANRIO", "#e7b8cb", "云朵与奶油色的午后，精灵们借走了三丽鸥的温柔。"),
    ("skullpanda-dontwanna", "SKULLPANDA", "不想不想系列", "DON'T WANNA", "#b7a1cd", "今天不赶路，把时间留给床、窗和发呆。"),
    ("skullpanda-garden", "SKULLPANDA", "光织园系列", "LIGHT GARDEN", "#b8cbb0", "用光与绒毛织一座不设围墙的花园。"),
    ("skullpanda-coffee", "SKULLPANDA", "咖啡工厂系列", "COFFEE FACTORY", "#c3a58b", "夜色烘焙，心事研磨，最后加一份安静。"),
    ("skullpanda-pony", "SKULLPANDA", "小马宝莉系列", "MY LITTLE PONY", "#d8a2c8", "友谊的魔法落在鬃毛上，每一匹都有自己的颜色。"),
    ("skullpanda-wednesday", "SKULLPANDA", "星期三毛绒公仔挂件", "WEDNESDAY PLUSH", "#9d9db6", "奈弗莫尔学院的门开了，黑色领带先走进去。"),
    ("skullpanda-throttle", "SKULLPANDA", "马力全开系列", "FULL THROTTLE", "#b9b0b2", "把风留在身后，让鬃毛替它说话。"),
    ("skullpanda-dailywonder", "SKULLPANDA", "平日奇境系列", "EVERYDAY WONDER", "#c3aebe", "平凡日子里，也会突然掉进一小块奇境。"),
    ("skullpanda-plum", "SKULLPANDA", "庭前墨梅系列", "PLUM INK", "#b9a6a1", "墨色落笔，梅花在庭前慢慢开。"),
    ("skullpanda-temperature", "SKULLPANDA", "温度系列", "TEMPERATURE", "#a8b8c7", "天气有温度，心事也有。"),
    ("skullpanda-flowers", "SKULLPANDA", "花的四幕戏系列", "FLOWER IN FOUR ACTS", "#c7a6b4", "以花为幕，一场戏分成四段慢慢上演。"),
    ("skullpanda-gate", "SKULLPANDA", "进退之门系列", "GATE", "#a99bb8", "门开或不开，都是一种选择。"),
    ("twinkle-heartbeat", "TWINKLE TWINKLE", "怦然心动系列", "HEARTBEAT", "#efc38d", "星星落在毛绒上，心跳就有了形状。"),
    ("twinkle-123", "TWINKLE TWINKLE", "123！星星人系列", "123 TWINKLE", "#efc38d", "数到三，星星人就从天上跳下来。"),
    ("zsiga-slow", "ZSIGA", "慢下来系列", "SLOW DOWN", "#b6c2a4", "把速度放慢，才听得见牧场和云的声音。"),
    ("zsiga-wintergift", "ZSIGA", "收礼物的冬天系列", "WINTER GIFT", "#c7b6a4", "冬天把礼物藏进雪里，等人拆开。"),
    ("zsiga-sunlight", "ZSIGA", "在日光下系列", "IN SUNLIGHT", "#d9c2a2", "日光落下来，长发和影子一起变软。"),
    ("sweetbean-holiday", "SWEET BEAN", "属于你的节日系列", "YOUR HOLIDAY", "#e5b7a2", "节日不必等日历，想庆祝的时候就是。"),
    ("sweetbean-hug", "SWEET BEAN", "爱的抱抱系列", "HUGS OF LOVE", "#e0a9b4", "抱抱不解决所有问题，但可以先接住情绪。"),
]

SERIES_BY_PAIR = {(ip, series): key for key, ip, series, _en, _accent, _intro in SERIES_DEFS}
SERIES_ORDER_KEYS = [row[0] for row in SERIES_DEFS]

# Character-specific descriptions written after looking at every source photo.
STORIES = {
    "恋夏一族": "黑卷发里别着一枚红白波点蝴蝶结，像把一整个夏天打包进行李。她第一次没有哭，只是把墨镜推上去，认真看了一眼海。",
    "长帽圣诞": "白色的长帽垂到肩头，绿缎带在风里轻轻晃。她替圣诞老人保管那顶太长的帽子，也替每个路过的人保管一句没说出口的愿望。",
    "小米": "厨师帽压着两只圆耳朵，蓝色背带裤上还留着厨房里的香气。小米把第一道菜端给夜色，盘沿上落着一小片月光。",
    "胡迪": "棕色牛仔帽檐压得很低，格纹衬衫和警徽都在提醒他：今天也要做一个可靠的人。他把绳子搭在肩上，准备把迷路的故事一个个找回来。",
    "依赖": "他把自己的重量交给一根看不见的线，确认世界会接住他。浅蓝色的绒毛在光里安静下来，像一句刚学会的“别走”。",
    "守护": "小小的身体站得笔直，灰白的绒毛像一层柔软的铠甲。他好像正在替谁守住一场梦，连呼吸都放得很轻。",
    "安全感": "深灰色的绒毛把周围的光收拢，像一只安静的手掌。他把双手放在膝上，知道这一刻不需要向任何人证明什么。",
    "懵懂": "眼睛先于语言醒来，世界还很新，连影子都没有名字。他坐在浅紫色的光里，认真地想一个刚刚发现的问题。",
    "新奇": "他把手指伸向光，第一次发现影子也会回应。奶白色的绒毛沾了一点蓝，像刚拆开一封来自世界的信。",
    "眷恋": "粉色绒毛上还留着拥抱的温度，他还不懂告别，只知道靠近。那一点舍不得，被他悄悄收进了衣领里。",
    "陌生": "他站在新世界门口，先学会了用雾一样的眼睛打量。薄荷色的外套很轻，脚步却比想象中更稳。",
    "唐老鸭的歌唱": "水手领被风掀起来，他试着用唐老鸭的嗓音唱第一句，跑调也认真。蓝色的衣角晃了一下，整个码头都听见了。",
    "奇奇和蒂蒂": "两只淘气鬼藏在同一顶栗色帽子里，把一颗橡果分成两半。小小的心口别着花，像别着一枚秘密勋章。",
    "布鲁斯的房子": "他把找来的旧钥匙挂在胸前，梦想着有一天能打开布鲁斯的家。黄色绒毛上沾着一点白，像门口刚亮起的灯。",
    "米妮的气球": "红色波点系住一只气球，也系住了迪士尼午后最轻的一阵风。她穿着红黄相间的衣服，站在毯子边缘，等气球把她带走。",
    "高飞的恶作剧": "绿色帽尖上还挂着一点笑，他已经准备好下一个不太高明的恶作剧。黑色长耳垂下来，兜住了半句没说完的玩笑。",
    "黛丝的礼物": "她把手背在身后，礼物藏得不够好，缎带却先泄露了心意。浅紫色的披风扫过地面，像一阵温柔的脚步声。",
    "通关马": "马蹄踏过最后一关，屏幕上亮起通关的星。他把手柄举高，像举起一枚小小的勋章，酒红色的绒毛在灯下泛着光。",
    "警告汪汪": "耳朵比身体先听见风声，他站在门口，用一整身的黑白斑点发出警告。可那双眼分明在说：如果你愿意，也可以进来坐坐。",
    "经典可乐": "玻璃瓶里装着气泡，也装着夏天。Labubu 把瓶口贴向耳朵，听见一场永不散场的派对，红色领巾在风里轻轻飘。",
    "奶牛喵": "黑白奶牛猫从森林里溜出来，尾巴一卷，就把威严忘在了树后。毛茸茸的耳朵立着，像两面小小的旗。",
    "希望": "淡蓝色的绒毛里藏着一枚小小的日出，他把它捧给每一个还没睡的人。耳朵朝向窗外，像在等一句好消息。",
    "平静": "薄荷色的呼吸很慢，连周围的空气都跟着安静下来。她只是坐着，就让整个下午变得不再着急。",
    "幸运": "紫色耳朵微微竖起，像在听一枚四叶草落地的声音。她把手放在膝上，知道好事正在慢慢靠近。",
    "忠诚": "暖粉色的影子守在门口，等一个说好今晚会回来的人。尾巴安静地垂着，像一句没有期限的承诺。",
    "欢乐": "桃子色的笑从嘴角一直漫到耳朵尖，像一场没有理由的庆祝。她向前走了一步，连毯子上的小凸起都像在跳舞。",
    "爱": "他把心脏似的颜色穿在身上，走到哪里都像带着一封没寄出的情书。那封信没有署名，但每个看见他的人都知道写给谁。",
    "羞羞答": "灰色兜帽压得低低的，条纹衫里藏着一点不想被看见的害羞。他把手插进牛仔裤口袋，假装自己只是路过。",
    "海盐椰椰": "粉色的糖霜上落了一点海盐，甜里带着微咸的风。她把手举到脸边，像在接住一整个夏天的海。",
    "荔枝莓莓": "两颗莓果色的心跳挨在一起，像一对刚刚学会牵手的双胞胎。紫色的绒毛叠在一起，连影子都比平时更近一点。",
    "小皇后": "盒子还没拆，棋盘上的王座已经替她留好。小皇后在透明窗后眨了眨眼，粉色的发梢压着一顶小小的金冠。",
    "再睡十分钟": "飞行帽还没摘，她已经把闹钟按掉，把清晨往后挪了十分钟。红色衣角蜷在毯子上，像一只不愿起飞的鸟。",
    "宅一整天": "白色蝴蝶结歪在发间，今天的计划只有一项：把一整天都留给房间。她穿着印着小字的睡衣，把世界关在门外。",
    "清池": "一圈浅绿羽毛围成安静的池水，她坐在光里，不惊动任何涟漪。眼睛抬起来时，像池底刚刚亮起的一颗星。",
    "漫煦": "浅粉色的绒毛把午后的暖意织成一件外套，她只是慢慢地走过来。帽檐上那一点红，像花园里最后开的一朵花。",
    "特调师": "她把一枚咖啡豆别在耳后，调出一杯只有夜色才懂的配方。白色绒毛上系着小小的钥匙扣，像随身带着一间咖啡工厂。",
    "柔柔": "粉色蕾丝像一朵刚刚散开的云，她说话的声音比羽毛还轻。黄色的发梢从帽檐下露出来，像阳光碰了一下她的肩膀。",
    "珍奇": "王冠与头纱都准备好了，她把自己打扮成一场盛大的出场。白色蕾丝垂到毯子上，连空气都自动让开了一条路。",
    "碧琪": "亮粉色的鬃毛藏不住，她把每一次相遇都当成一场派对。耳朵上的蝴蝶结跟着晃，像两枚刚刚点亮的彩灯。",
    "紫悦": "深紫的鬃毛收拢星光，她翻开书页，把夜晚读成一张星图。书页上那点蓝，像她刚刚记住的一句咒语。",
    "奈弗莫尔学院校服版": "校服扣到最上面一颗，黑色领带垂得笔直。奈弗莫尔的钟声在盒子外面响起，她隔着透明窗看了一眼，像在确认自己真的被收藏了。",
    "千里马": "白色的鬃毛被风梳向身后，它跑得很快，却把缰绳留给了你。金色的挂饰在胸前轻响，像一枚被跑热的小铃铛。",
    "晒娃包盲盒": "透明的小包像理发店的橱窗，她把小小的心事装进去，拉链一拉，夏天就安静了。绿色包边在灯下透出一点薄荷色的光。",
    "丝绒午后": "粉色长发垂在白色裙摆上，午后的丝绒光线在她脚边停住。她把手指交叠在身前，像在等一场不必赶时间的茶会。",
    "反叛日记": "银色头发压着一页没有写完的日记，红色格纹裙替她说了不。白衬衫的领子立得很高，像一道不肯低头的墙。",
    "浅蓝序曲": "浅蓝色衬衫像理发店窗外的天色，黑框眼镜后面藏着一段还没开始的序曲。牛仔裙的口袋里，放着一张折好的旧票根。",
    "MOKOKO": "粉色兔耳垂在肩头，链条在日光里轻轻响，她把夏天牵在手里。毛绒裙摆蓬起来，像一杯刚打好的草莓奶昔。",
    "大耳狗": "云朵一样的大耳朵盖住额头，牛仔外套里藏着一阵软软的风。他站在光里，像刚从三丽鸥的下午茶桌边跑出来。",
    "美乐蒂": "粉色兜帽上落着一点奶油色的光，她把美乐蒂的温柔穿在身上。蝴蝶结认真系好，连影子都变得甜甜的。",
    "猫猫恋人": "星星落在橙色绒毛上，猫猫把心跳藏进一颗小小的星形挂饰，等你靠近才听得见。粉色领结歪歪的，像一句没说完整的情话。",
    "巴小飞": "红黑小披风被风撑开，他已经在起跑线上，准备把今天跑成一道闪电。",
    "火腿": "储蓄罐里装着硬币，也装着小小的雄心；他站在毯子上，认真数着下一次出发。",
    "云朵捕梦手": "软绵绵的帽檐上落着一朵云，她伸手去接，梦里的小东西就这样被轻轻网住。",
    "星星守夜人": "黄色的星形帽檐低低压着，他替夜色守着最后一颗没有入睡的星星。",
    "乖乖猪": "粉色的猪猪外套扣得整整齐齐，她把两只小手放在身前，像在认真答应什么。",
    "趴趴兔": "蓝色兔耳垂到肩膀，他趴在自己的小世界里，连时间经过都放轻了脚步。",
    "意外发现": "Labubu 在可口可乐瓶盖里发现了一枚小小的惊喜，红白配色像一场冰镇气泡的庆祝。",
    "沙拉": "绿色便利店的门刚开，他把一份蔬菜沙拉端得高高的，像在展示今天的战利品。",
    "胆怯羞涩的你": "银灰鹿角从发间伸出来，她把视线放低，连呼吸都在小心地避开陌生。",
    "根.固远": "墨色的鹿角与裙摆像一笔落定的梅花，她站得很稳，把来处和远方一起扎进土里。",
    "下雨天": "她戴着透明雨帽，雨滴在帽檐上排队；世界变得模糊，心事反而更清楚。",
    "终章三重奏": "三个小小的身影围成一圈，黑玫瑰在中间打开最后一幕，像一首歌终于唱到结尾。",
    "密织的纽带": "粉色的发辫缠着细小的结，她把关系一层层织紧，直到彼此再也不能轻易走散。",
    "托尼托尼.乔巴": "蓝帽子压着鹿角，乔巴揣着药箱站在毯子上，认真得像在等一位需要帮助的病人。",
    "撒谎布": "狙击手的护目镜推到额头上，他张嘴准备讲一个不太可靠的故事，眼睛却先笑了。",
    "特拉法尔加.罗": "斑点帽檐遮住半张脸，他把手术刀藏在袖口，冷静得像一场还没开始的手术。",
    "甚平": "蓝鲸的斗篷垂在肩上，他站得笔直，像一块不会退让的海。",
    "罗罗诺亚.佐罗": "绿发从帽檐下翘出来，三把刀安静地收好；他朝前走，方向从来不靠指南针。",
    "长发": "白色长发像一张还没落笔的纸，她把它包在帽檐里，只露出一点柔软的光。",
    "午后牧场": "她躺进一片小小的牧场，草丛、栅栏和云都围过来，午后终于慢得像一场午睡。",
    "吹浪花": "浅金色的头发贴着海面，她鼓起脸颊吹开浪花，把咸咸的风送向更远的地方。",
    "打闹的精灵": "绿色的小精灵举着树枝，正要去追一只看不见的同伴；森林里的规矩，是玩到天黑。",
    "护住水源": "她俯身抱住一汪蓝色的水，像抱着一个易碎的梦；头发垂下来，替水面挡住风。",
    "晾晒衣服": "她把白衬衫一件件挂起，日光穿过布料，连衣角都变得轻飘飘的。",
    "赖在云里": "她整个人陷进粉白色的云朵里，假装听不见闹钟；今天的世界可以晚一点开始。",
    "跟紧队伍": "她抱着花束跟在队伍后面，步伐不大，却一次也没有掉队。",
    "野营的夜晚": "深蓝的斗篷盖住膝盖，她坐在营火旁，等一颗星落进自己的帽檐。",
    "等待来信": "红色的兜帽在白裙上格外醒目，她守着一封还没到的信，把等待也过成了节日。",
    "姜饼朋友": "透明的姜饼人挂饰里藏着一整个节日，她把它举高，糖霜的香气就从里面漏出来。",
    "收到心愿": "红色的圣诞帽子垂着白色绒球，她把礼物袋抱在怀里，像抱住一个刚刚实现的愿望。",
    "雪花": "她戴着毛茸茸的雪帽，手里捧着雪白的花，冬天的第一片雪落在她肩上，没有化。",
    "当我感到平静时": "她缩进柔软的壳里，眼睛半闭，周围的声音都退到很远，只剩呼吸在慢慢起伏。",
    "当我生气时": "红色的小帽子竖起来，她把嘴巴抿紧，愤怒在小小的身体里烧成一团可爱的火。",
    "跷跷板说": "两个星星人坐在跷跷板两端，一个升起，一个落下；世界暂时找到了它的平衡。",
}

TITLE_OVERRIDES = {
    "Labubu × 可口可乐联名": "经典可乐",
    "THE MONSTERS 晒晒夏日系列-mokoko": "MOKOKO",
}


def normalize_ip(raw: str) -> str:
    return raw


SERIES_ALIASES = {
    "PIXAR Series Figures系列": "PIXAR联名系列",
    "PIXAR Series Figures": "PIXAR联名系列",
    "可口可乐联名": "可口可乐系列",
    "可口可乐系列": "可口可乐系列",
}


def normalize_series(raw: str) -> str:
    value = raw.strip()
    value = re.sub(r"^[×xX]\s*", "", value)
    value = re.sub(r"\s+", " ", value)
    return SERIES_ALIASES.get(value, value)


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "series"


def parse_filename(path: Path):
    stem = path.stem
    for prefix, ip in IP_PREFIXES:
        if stem.lower().startswith(prefix.lower()):
            rest = stem[len(prefix):].strip()
            break
    else:
        return None
    rest = rest.replace("×", " × ")
    rest = re.sub(r"\s+", " ", rest).strip()
    if not rest:
        return None
    # Prefer the last hyphen as the series/character separator. A dot is only
    # used when there is no hyphen, so names like "罗罗诺亚.佐罗" stay intact.
    matches = list(re.finditer(r"\s*-\s*", rest))
    if not matches:
        matches = list(re.finditer(r"\s*\.\s*", rest))
    if matches:
        sep = matches[-1]
        series = rest[:sep.start()].strip(" .-")
        title = rest[sep.end():].strip(" .-")
    else:
        series = rest
        title = rest
    series = normalize_series(series)
    title = re.sub(r"\s+", " ", title).strip()
    if stem in TITLE_OVERRIDES:
        title = TITLE_OVERRIDES[stem]
    return {"ip": ip, "series": series, "title": title}


def hex_to_rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hsl(rgb):
    r, g, b = (v / 255 for v in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    h = s = 0
    l = (mx + mn) / 2
    if mx != mn:
        d = mx - mn
        s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
        if mx == r:
            h = (g - b) / d + (6 if g < b else 0)
        elif mx == g:
            h = (b - r) / d + 2
        else:
            h = (r - g) / d + 4
        h /= 6
    return round(h * 360), round(s * 100), round(l * 100)


def build_background():
    w, h = FULL_SIZE
    base = Image.new("RGB", FULL_SIZE, "#070605")
    px = base.load()
    for y in range(h):
        t = y / max(1, h - 1)
        # near-black warm charcoal, lighter at the centre
        top = (13, 11, 9)
        bottom = (4, 4, 4)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * (t ** 1.4)) for i in range(3))
        for x in range(w):
            px[x, y] = c

    # soft warm pool of light behind the object
    glow = Image.new("L", FULL_SIZE, 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-120, 270, w + 120, h + 100), fill=96)
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    warm = Image.new("RGB", FULL_SIZE, (90, 67, 38))
    base = Image.composite(warm, base, glow.point(lambda v: int(v * 0.24)))

    # very fine grain in the mat
    noise = Image.effect_noise(FULL_SIZE, 8).convert("L")
    noise = noise.filter(ImageFilter.GaussianBlur(0.5))
    grain = Image.new("RGB", FULL_SIZE, (128, 118, 105))
    base = Image.blend(base, Image.composite(grain, base, noise), 0.035)
    return base


_BACKGROUND = None


def get_background():
    global _BACKGROUND
    if _BACKGROUND is None:
        _BACKGROUND = build_background()
    return _BACKGROUND.copy()


def make_frame(photo: Image.Image) -> Image.Image:
    photo = ImageOps.exif_transpose(photo).convert("RGB")
    card = get_background()
    image = ImageOps.fit(photo, INNER, method=Image.Resampling.LANCZOS, centering=(0.5, 0.56))

    # shadow under the photographic plate
    shadow = Image.new("RGBA", FULL_SIZE, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((MAT[0] + 6, MAT[1] + 10, MAT[2] + 6, MAT[3] + 10), 2, fill=(0, 0, 0, 210))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    card = Image.alpha_composite(card.convert("RGBA"), shadow).convert("RGB")
    card.paste(image, (MAT[0], MAT[1]))

    draw = ImageDraw.Draw(card, "RGBA")
    # outer gold liner and a quieter inner liner
    draw.rectangle((MAT[0] - 2, MAT[1] - 2, MAT[2] + 1, MAT[3] + 1), outline=(198, 162, 106, 220), width=2)
    draw.rectangle((MAT[0] + 5, MAT[1] + 5, MAT[2] - 5, MAT[3] - 5), outline=(96, 74, 45, 150), width=1)

    # corner ticks on the mat
    tick = 28
    for x, y, dx, dy in [
        (MAT[0] - 20, MAT[1] - 20, 1, 1),
        (MAT[2] + 20, MAT[1] - 20, -1, 1),
        (MAT[0] - 20, MAT[3] + 20, 1, -1),
        (MAT[2] + 20, MAT[3] + 20, -1, -1),
    ]:
        draw.line((x, y, x + dx * tick, y), fill=(205, 169, 109, 150), width=1)
        draw.line((x, y, x, y + dy * tick), fill=(205, 169, 109, 150), width=1)

    # a vignette that keeps the eye on the object
    vignette = Image.new("L", FULL_SIZE, 0)
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, FULL_SIZE[0], FULL_SIZE[1]), fill=255)
    vd.ellipse((-260, -100, FULL_SIZE[0] + 260, FULL_SIZE[1] + 100), fill=0)
    vignette = vignette.filter(ImageFilter.GaussianBlur(130))
    dark = Image.new("RGBA", FULL_SIZE, (2, 2, 2, 100))
    card = Image.composite(dark, card.convert("RGBA"), vignette).convert("RGB")
    return card


def write_js_series(series_meta):
    def js_val(value):
        return json.dumps(value, ensure_ascii=False)

    lines = [
        "/* STELLAR ARCHIVE — series index, built from the real collection. */",
        "(function () {",
        '  "use strict";',
        "",
        "  const SERIES = {",
    ]
    for key in SERIES_ORDER_KEYS:
        meta = series_meta[key]
        lines.append(f"    {js_val(key)}: {{")
        for field in [
            "key", "name", "cn", "collection", "collectionEn", "ip", "ipCn",
            "seriesCn", "seriesEn", "accent", "accentDim", "hue", "intro",
        ]:
            lines.append(f"      {field}: {js_val(meta[field])},")
        lines.append(f"      keywords: {js_val(meta['keywords'])},")
        lines.append("    },")
    lines.append("    other: {")
    other = {
        "key": "other", "name": "OTHER", "cn": "未归类", "collection": "自由收藏",
        "collectionEn": "FREE ARCHIVE", "ip": "OTHER", "ipCn": "未归类",
        "seriesCn": "自由收藏", "seriesEn": "FREE ARCHIVE", "accent": "#cda96d",
        "accentDim": "#8f7449", "hue": 37, "intro": "不急着归类，先让它成为被喜欢的那一件。",
        "keywords": ["自由收藏", "未归类", "非泡泡玛特", "other"],
    }
    for field in ["key", "name", "cn", "collection", "collectionEn", "ip", "ipCn", "seriesCn", "seriesEn", "accent", "accentDim", "hue", "intro"]:
        lines.append(f"      {field}: {js_val(other[field])},")
    lines.append(f"      keywords: {js_val(other['keywords'])},")
    lines.append("    },")
    lines.append("  };")
    lines.append("")
    lines.append(f"  const ORDER = {js_val(SERIES_ORDER_KEYS)};")
    lines.append("")
    lines.append("  function findByKey(key) { return SERIES[key] || null; }")
    lines.append("  function escapeHTML(value) {")
    lines.append('    return String(value == null ? "" : value)')
    lines.append('      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")')
    lines.append('      .replace(/"/g, "&quot;").replace(/\'/g, "&#39;");')
    lines.append("  }")
    lines.append("  function formatDate(value) {")
    lines.append('    if (!value) {')
    lines.append('      const now = new Date();')
    lines.append('      return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;')
    lines.append("    }")
    lines.append("    return String(value);")
    lines.append("  }")
    lines.append("  function pad(n, length = 2) { return String(n).padStart(length, \"0\"); }")
    lines.append("")
    lines.append("  window.STELLAR_SERIES = SERIES;")
    lines.append("  window.STELLAR_SERIES_ORDER = ORDER;")
    lines.append("  window.STELLAR_SERIES_FIND = findByKey;")
    lines.append("  window.STELLAR_ESCAPE = escapeHTML;")
    lines.append("  window.STELLAR_FORMAT_DATE = formatDate;")
    lines.append("  window.STELLAR_PAD = pad;")
    lines.append("})();")
    SERIES_JS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    if not SRC.exists():
        raise SystemExit(f"Source folder not found: {SRC}")

    rows = []
    skipped = []
    for path in sorted(SRC.iterdir()):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        parsed = parse_filename(path)
        if not parsed:
            skipped.append(path.name)
            continue
        parsed["path"] = path
        parsed["file"] = path.name
        rows.append(parsed)

    # normalize series names and build any unknown series group
    series_meta = {}
    for key, ip, series_cn, series_en, accent, intro in SERIES_DEFS:
        hue = rgb_to_hsl(hex_to_rgb(accent))[0]
        series_meta[key] = {
            "key": key,
            "name": ip,
            "cn": series_cn,
            "collection": series_cn,
            "collectionEn": series_en,
            "ip": ip,
            "ipCn": IP_CN.get(ip, ip),
            "seriesCn": series_cn,
            "seriesEn": series_en,
            "accent": accent,
            "accentDim": "#" + "".join(f"{max(0, int(c * 0.62)):02x}" for c in hex_to_rgb(accent)),
            "hue": hue,
            "intro": intro,
            "keywords": [ip, IP_CN.get(ip, ip), series_cn, series_en],
        }
        if key.startswith("monsters-") or key == "labubu-onepiece":
            series_meta[key]["keywords"] += ["THE MONSTERS", "精灵天团"]

    for row in rows:
        pair = (row["ip"], row["series"])
        if pair in SERIES_BY_PAIR:
            row["seriesKey"] = SERIES_BY_PAIR[pair]
            continue
        key = slugify(f"{row['ip']}-{row['series']}")
        if key not in series_meta:
            accent = "#cda96d"
            series_meta[key] = {
                "key": key, "name": row["ip"], "cn": row["series"],
                "collection": row["series"], "collectionEn": "",
                "ip": row["ip"], "ipCn": IP_CN.get(row["ip"], row["ip"]),
                "seriesCn": row["series"], "seriesEn": "",
                "accent": accent, "accentDim": "#8f7449", "hue": 37,
                "intro": "为还没有归处的藏品保留的一席。",
                "keywords": [row["ip"], row["series"]],
            }
            SERIES_ORDER_KEYS.append(key)
        row["seriesKey"] = key

    # stable independent numbering: series catalogue order, then source name
    series_rank = {key: index for index, key in enumerate(SERIES_ORDER_KEYS)}
    rows.sort(key=lambda r: (series_rank.get(r["seriesKey"], 999), r["file"].lower()))

    numbering = {}
    if NUMBERING.exists():
        try:
            numbering = json.loads(NUMBERING.read_text(encoding="utf-8"))
        except Exception:
            numbering = {}
    used = {int(code.split("-")[-1]) for code in numbering.values() if str(code).startswith("JJ-")}
    next_number = max(used, default=0) + 1
    for row in rows:
        code = numbering.get(row["file"])
        if not code:
            code = f"JJ-{next_number:03d}"
            numbering[row["file"]] = code
            next_number += 1
        row["code"] = code
        row["no"] = code.split("-")[-1]
        row["id"] = code
    rows.sort(key=lambda r: int(r["code"].split("-")[-1]))
    NUMBERING.write_text(json.dumps(numbering, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # clean old demo assets and write the new plate files
    for sub in ["full", "card", "thumb"]:
        target = ASSETS / sub
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)

    items = []
    for row in rows:
        meta = series_meta[row["seriesKey"]]
        with Image.open(row["path"]) as source:
            full = make_frame(source)
        full.save(ASSETS / "full" / f"{row['no']}.webp", "WEBP", quality=88, method=6)
        card = full.resize(CARD_SIZE, Image.Resampling.LANCZOS)
        card.save(ASSETS / "card" / f"{row['no']}.webp", "WEBP", quality=84, method=6)
        thumb = full.resize(THUMB_SIZE, Image.Resampling.LANCZOS)
        thumb.save(ASSETS / "thumb" / f"{row['no']}.webp", "WEBP", quality=80, method=6)

        story = STORIES.get(row["title"])
        if not story:
            story = f"{meta['intro']}「{row['title']}」是这套系列里留给她的一件小小心事。"
        file_date = datetime.fromtimestamp(row["path"].stat().st_mtime)
        items.append({
            "id": row["id"],
            "no": row["no"],
            "code": row["code"],
            "seriesKey": row["seriesKey"],
            "series": meta["name"],
            "seriesCn": meta["ipCn"],
            "collection": meta["collection"],
            "collectionEn": meta["collectionEn"],
            "character": row["title"],
            "title": row["title"],
            "titleEn": "",
            "story": story,
            "rarity": "私人藏品",
            "date": file_date.strftime("%Y.%m.%d"),
            "accent": meta["accent"],
            "confidence": 1,
            "manual": True,
            "sample": False,
            "owner": "晶晶",
            "ownerEn": "JINGJING",
            "sourceFile": row["file"],
            "thumb": f"assets/photos/thumb/{row['no']}.webp{ASSET_SUFFIX}",
            "card": f"assets/photos/card/{row['no']}.webp{ASSET_SUFFIX}",
            "src": f"assets/photos/full/{row['no']}.webp{ASSET_SUFFIX}",
        })

    DATA_JS.write_text(
        "/* STELLAR ARCHIVE — JINGJING collection. Built from the real photo folder. */\n"
        "window.STELLAR_DATA = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    write_js_series(series_meta)

    MANIFEST.write_text(json.dumps({
        "source": str(SRC),
        "count": len(items),
        "series": len(SERIES_ORDER_KEYS),
        "skipped": skipped,
        "items": [
            {k: v for k, v in item.items() if k not in {"story"}}
            for item in items
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Built {len(items)} plates / {len(SERIES_ORDER_KEYS)} series from {SRC}")
    if skipped:
        print("Skipped unnamed or unreadable files:", ", ".join(skipped))
    for key in SERIES_ORDER_KEYS:
        count = sum(1 for item in items if item["seriesKey"] == key)
        print(f"  {series_meta[key]['name']:<16} {series_meta[key]['collection']:<28} {count}")


if __name__ == "__main__":
    main()
