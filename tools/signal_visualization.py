import matplotlib.pyplot as plt
import matplotlib.patches as patches

# 캔버스 설정 (512x512)
fig, ax = plt.subplots(figsize=(5, 5))
ax.set_xlim(0, 512)
ax.set_ylim(512, 0) # SVG 좌표계 (Y축 반전)
ax.set_aspect('equal')
ax.axis('off') # 축 숨기기

# 색상 정의 (Tailwind Zinc & Indigo)
BG_COLOR = "#18181B" # Zinc 900
DOT_COLOR_1 = "#52525B" # Zinc 600
DOT_COLOR_2 = "#71717A" # Zinc 500
TRANSITION_COLOR = "#A1A1AA" # Zinc 400
SIGNAL_COLOR = "#6366F1" # Indigo 500
SPARK_COLOR = "#818CF8" # Indigo 400

# 1. 배경 (Background)
bg = patches.Rectangle((0, 0), 512, 512, linewidth=0, facecolor=BG_COLOR)
ax.add_patch(bg)

# 2. 좌측 소음 (The Echo) - 투명도 적용 시뮬레이션
# (Matplotlib에서는 alpha값으로 조절)
echo_dots = [
    {'x': 120, 'y': 256, 'r': 12, 'c': DOT_COLOR_1, 'a': 0.2},
    {'x': 120, 'y': 200, 'r': 8, 'c': DOT_COLOR_1, 'a': 0.1},
    {'x': 120, 'y': 312, 'r': 8, 'c': DOT_COLOR_1, 'a': 0.1},
    {'x': 170, 'y': 256, 'r': 16, 'c': DOT_COLOR_2, 'a': 0.4},
    {'x': 170, 'y': 180, 'r': 6, 'c': DOT_COLOR_2, 'a': 0.2},
    {'x': 170, 'y': 332, 'r': 6, 'c': DOT_COLOR_2, 'a': 0.2},
]

for dot in echo_dots:
    circle = patches.Circle((dot['x'], dot['y']), dot['r'], color=dot['c'], alpha=dot['a'])
    ax.add_patch(circle)

# 3. 중앙 필터 (The Transition)
transition = patches.Circle((230, 256), 24, color=TRANSITION_COLOR, alpha=0.7)
ax.add_patch(transition)

# 4. 우측 신호 (The Signal) - 선
# LineString 대신 얇은 Rectangle이나 plot으로 표현
plt.plot([280, 410], [256, 256], color=SIGNAL_COLOR, linewidth=10, solid_capstyle='round')

# 5. 통찰 (The Spark) - 원
spark = patches.Circle((410, 256), 16, color=SPARK_COLOR)
ax.add_patch(spark)

# 결과 출력
plt.show()
