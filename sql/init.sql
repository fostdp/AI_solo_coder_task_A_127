-- ============================================
-- 古代云锦织机提花工艺仿真与织物结构分析系统
-- PostgreSQL 数据库初始化脚本
-- ============================================

CREATE DATABASE yunjin_weaving;
\c yunjin_weaving;

-- 织机表
CREATE TABLE IF NOT EXISTS loom (
    id BIGSERIAL PRIMARY KEY,
    loom_code VARCHAR(50) UNIQUE NOT NULL,
    loom_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    status VARCHAR(20) DEFAULT 'IDLE',
    total_warp_count INTEGER DEFAULT 1200,
    weft_density_target DOUBLE PRECISION DEFAULT 60.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 传感器数据表
CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT NOT NULL REFERENCES loom(id) ON DELETE CASCADE,
    warp_tension DOUBLE PRECISION NOT NULL,
    weft_density DOUBLE PRECISION NOT NULL,
    pattern_position INTEGER NOT NULL,
    fabric_progress DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    warp_tension_array TEXT,
    shed_opening_array TEXT
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_loom_id ON sensor_data(loom_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp);

-- 告警表
CREATE TABLE IF NOT EXISTS alert (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT NOT NULL REFERENCES loom(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    alert_level VARCHAR(20) DEFAULT 'WARNING',
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_loom_id ON alert(loom_id);
CREATE INDEX IF NOT EXISTS idx_alert_resolved ON alert(resolved);

-- 织物结构分析记录表
CREATE TABLE IF NOT EXISTS fabric_analysis (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT NOT NULL REFERENCES loom(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,
    weave_pattern VARCHAR(50),
    warp_count INTEGER,
    weft_count INTEGER,
    texture_data TEXT,
    fft_spectrum TEXT,
    result_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fabric_analysis_loom_id ON fabric_analysis(loom_id);

-- 织造仿真状态表
CREATE TABLE IF NOT EXISTS weaving_simulation (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT UNIQUE NOT NULL REFERENCES loom(id) ON DELETE CASCADE,
    current_weft_row INTEGER DEFAULT 0,
    shed_state TEXT,
    interlacement_matrix TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 复合索引：传感器数据按织机+时间范围查询
CREATE INDEX IF NOT EXISTS idx_sensor_data_loom_time ON sensor_data(loom_id, timestamp DESC);

-- 覆盖索引：活跃告警快速查询
CREATE INDEX IF NOT EXISTS idx_alert_active ON alert(resolved, created_at DESC) WHERE resolved = FALSE;

-- 织机状态查询索引
CREATE INDEX IF NOT EXISTS idx_alert_type_level ON alert(alert_type, alert_level);

-- 仿真状态查询
CREATE INDEX IF NOT EXISTS idx_weaving_simulation_loom ON weaving_simulation(loom_id);

-- 织物分析按时间倒序
CREATE INDEX IF NOT EXISTS idx_fabric_analysis_loom_time ON fabric_analysis(loom_id, created_at DESC);

-- 初始数据
INSERT INTO loom (loom_code, loom_name, location, status, total_warp_count, weft_density_target)
VALUES 
('YJ-001', '南京云锦大花楼织机一号', '纺织史研究实验室A区', 'IDLE', 1200, 60.0),
('YJ-002', '南京云锦大花楼织机二号', '纺织史研究实验室A区', 'IDLE', 1400, 58.0)
ON CONFLICT (loom_code) DO NOTHING;
