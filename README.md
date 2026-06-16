# 古代云锦织机提花工艺仿真与织物结构分析系统

> 南京云锦大花楼织机复原研究 — 织造仿真 · 结构分析 · 实时告警

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose 编排                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Simulator   │  │ MQTT Broker  │  │       Frontend           │  │
│  │ (Python 3.11)│  │ (Mosquitto)  │  │  Nginx + Gzip + 反代     │  │
│  │  花本+张力   │  │  1883/9001   │  │  :80 → /api/ → backend   │  │
│  └──────┬───────┘  └──────────────┘  │  /websocket → ws upgrade │  │
│         │ HTTP                       └──────────┬───────────────┘  │
│         ▼                                       │                  │
│  ┌──────────────────────────────────────────────▼───────────────┐  │
│  │                    Backend (SpringBoot 3.2)                   │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐    │  │
│  │  │dtu_receiver │ │weaving_sim   │ │fabric_analyzer     │    │  │
│  │  │数据采集+校验│ │织造仿真+张力 │ │纹理分析+FFT+小波   │    │  │
│  │  └──────┬──────┘ └──────┬───────┘ └──────────┬─────────┘    │  │
│  │         │  Spring Events│          │           │              │  │
│  │         ▼               ▼          │           ▼              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │              alarm_ws (告警评估+WebSocket推送)         │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │  Actuator :8080/actuator | Prometheus metrics                │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │ JDBC                                  │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │                 PostgreSQL 16 (:5432)                         │  │
│  │  loom | sensor_data | alert | fabric_analysis | weaving_sim  │  │
│  │  5个复合/部分索引 + 4个基础索引                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │  Prometheus      │  │  Grafana         │                        │
│  │  :9090 抓取指标  │  │  :3000 可视化    │                        │
│  └──────────────────┘  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 事件驱动架构

```
POST /api/sensor/ingest
        │
        ▼
  DtuReceiverService.ingest()
   ├── validate(dto)     校验5项参数范围
   ├── save(dto)         持久化到PostgreSQL
   └── publishEvent(SensorDataReceivedEvent)
            │
            ├── WeavingSimulatorListener.onSensorDataReceived()
            │     ├── computeWarpTensionWithFriction()  8因子摩擦修正
            │     ├── 更新sensor_data.warp_tension_array
            │     └── autoAdvance? → processWeftInsertion()
            │                └── publishEvent(SimulationStepEvent)
            │
            └── AlarmWsListener.onSensorDataReceived()
                  ├── broadcastSensorData()   → /topic/sensor/{loomId}
                  ├── checkAndGenerateAlerts() 4类告警检测
                  └── broadcastAlert()         → /topic/alerts
```

## 快速部署

### 前置条件

- Docker 24+ / Docker Compose v2
- 至少 4GB 可用内存

### 一键启动

```bash
git clone <repo> && cd yunjin-weaving-system
docker compose up -d
```

等待约 90 秒后所有服务就绪：

| 服务 | 端口 | 访问地址 |
|------|------|----------|
| 前端界面 | 80 | http://localhost |
| 后端API | 8080 | http://localhost:8080/api/looms |
| PostgreSQL | 5432 | localhost:5432/yunjin_weaving |
| MQTT Broker | 1883/9001 | localhost:1883 |
| Prometheus | 9090 | http://localhost:9090 |
| Grafana | 3000 | http://localhost:3000 (admin/admin) |
| Actuator | 8080 | http://localhost:8080/actuator/health |

### 逐步部署

```bash
# 1. 仅启动数据库
docker compose up -d postgres

# 2. 等待数据库就绪后启动后端
docker compose up -d backend

# 3. 启动前端和监控
docker compose up -d frontend prometheus grafana

# 4. 启动传感器模拟器
docker compose up -d simulator

# 5. 查看所有服务状态
docker compose ps
```

### 停止与清理

```bash
docker compose down              # 停止容器
docker compose down -v           # 停止并删除数据卷
```

## 模拟器用法

### Docker 内运行（推荐）

模拟器默认使用 `dragon_cloud` 花本 + `normal` 张力配置，在 docker-compose.yml 中通过环境变量切换：

```yaml
simulator:
  environment:
    PATTERN: peony_brocade         # 花本模式
    TENSION_PROFILE: high_tension  # 张力配置
```

### 本地 Python 运行

```bash
pip install requests

# 默认参数
python simulator/loom_simulator.py --loom-id 1

# 指定花本和张力
python simulator/loom_simulator.py --loom-id 1 --pattern dragon_cloud --tension-profile normal

# 高张力 + 牡丹锦缎
python simulator/loom_simulator.py --loom-id 2 --pattern peony_brocade --tension-profile high_tension

# 松经 + 素缎平纹
python simulator/loom_simulator.py --loom-id 1 --pattern plain_silk --tension-profile loose_warp

# 老旧织机 + 八枚缎纹
python simulator/loom_simulator.py --loom-id 1 --pattern satin_8 --tension-profile worn_loom

# 自定义参数覆盖
python simulator/loom_simulator.py --loom-id 1 --pattern dragon_cloud --break-prob 0.02 --friction-mu 0.45

# 加速仿真 100ms/步
python simulator/loom_simulator.py --loom-id 1 --interval 0.1 --pattern dragon_cloud

# 使用外部配置文件
python simulator/loom_simulator.py --loom-id 1 --config simulator/simulator_config.json
```

### 花本模式

| 模式 | 名称 | 综框数 | 花本周期 | 说明 |
|------|------|--------|----------|------|
| `dragon_cloud` | 云龙纹大花 | 4综 | 240 | 经典云锦4综24通丝花本 |
| `peony_brocade` | 牡丹锦缎 | 8综 | 180 | 8综花本牡丹纹 |
| `plain_silk` | 素缎平纹 | 2综 | 2 | 1/1平纹基础组织 |
| `satin_8` | 八枚缎纹 | 8综 | 8 | 八枚三飞缎纹组织 |

### 张力配置

| 配置 | 名称 | 基础张力 | 摩擦系数 | 断纱概率 | 说明 |
|------|------|----------|----------|----------|------|
| `normal` | 正常织造 | 2.2N | 0.28 | 0.5% | 标准织造参数 |
| `high_tension` | 高张力织造 | 3.8N | 0.35 | 2.0% | 紧经高张力，断纱增多 |
| `loose_warp` | 松经织造 | 1.2N | 0.18 | 0.1% | 松经低张力，波动大 |
| `worn_loom` | 老旧织机 | 2.2N | 0.45 | 1.5% | 高摩擦，频繁断纱 |

## 监控

### Actuator 端点

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/prometheus
curl http://localhost:8080/actuator/metrics
```

### Grafana 看板

1. 访问 http://localhost:3000 (admin/admin)
2. 添加数据源 → Prometheus → URL: `http://prometheus:9090`
3. 导入 JVM、Spring Boot、HTTP 指标面板

### 关键监控指标

| 指标 | 说明 |
|------|------|
| `jvm_memory_used_bytes` | JVM 内存使用 |
| `http_server_requests_seconds` | HTTP 请求延迟 |
| `system_cpu_usage` | CPU 使用率 |
| `hikaricp_connections_active` | 数据库连接池 |

## 项目结构

```
├── docker-compose.yml          容器编排
├── mosquitto.conf              MQTT Broker配置
├── prometheus.yml              Prometheus采集配置
├── sql/
│   └── init.sql                PostgreSQL初始化(9索引+种子数据)
├── backend/
│   ├── Dockerfile              多阶段构建(JDK17→JRE17)
│   ├── pom.xml                 Maven依赖(Actuator+Prometheus)
│   └── src/main/java/com/yunjin/system/
│       ├── dtu_receiver/       数据采集+校验+事件发布
│       ├── weaving_simulator/  织造仿真+张力计算
│       ├── fabric_analyzer/    纹理分析+FFT+小波
│       ├── alarm_ws/           告警评估+WebSocket推送
│       ├── event/              Spring Events事件类
│       ├── config/             YAML配置类+Properties
│       ├── entity/             JPA实体
│       ├── repository/         Spring Data Repository
│       └── dto/                数据传输对象
├── frontend/
│   ├── Dockerfile              Nginx Alpine
│   ├── nginx.conf              Gzip+反代+WebSocket
│   ├── index.html
│   └── js/
│       ├── loom-3d.js          Three.js织机3D渲染
│       ├── fabric_panel.js     Canvas织造视图+纹理分析
│       ├── alert-panel.js      实时告警面板
│       └── app.js              主控制+WebSocket订阅
└── simulator/
    ├── Dockerfile              Python 3.11
    ├── loom_simulator.py       传感器模拟器(4花本×4张力)
    └── simulator_config.json   花本+张力预置配置
```

## 配置参数

所有织造参数和图像处理参数均外置到 application.yml：

```yaml
weaving:
  simulation:
    tension-base: 2.2              # 基础张力(N)
    friction-coefficient: 0.28     # 摩擦系数
    initial-weft-rows: 500         # 初始纬纱行数
    max-weft-rows: 10000           # 最大纬纱行数
    auto-advance: false            # 自动推进仿真
  alert:
    warp-tension-min: 0.5          # 张力下限
    warp-tension-max: 5.0          # 张力上限
    warp-break-epsilon: 0.05       # 断头判定阈值
    pattern-jump-window: 5         # 花本错位滑动窗口

image-processing:
  fft:
    max-size: 512                  # FFT最大点数
  wavelet:
    levels: 4                      # Haar小波分解层数
  texture:
    display-size: 256              # 纹理图尺寸
```

Docker 环境变量覆盖示例：`WEAVING_SIMULATION_TENSION_BASE=3.5`

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Three.js r160 + Canvas 2D + SockJS/STOMP |
| 后端 | Java 17 + SpringBoot 3.2 + Spring Events |
| 数据库 | PostgreSQL 16 (9索引) |
| 消息 | MQTT (Mosquitto) |
| 监控 | Actuator + Micrometer + Prometheus + Grafana |
| 容器 | Docker Compose + 多阶段构建 |
| 反代 | Nginx (Gzip + WebSocket) |
