#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古代云锦织机传感器模拟器
=====================
支持预置花本模式(dragon_cloud/peony_brocade/plain_silk/satin_8)
支持预置张力配置(normal/high_tension/loose_warp/worn_loom)

使用:
    python loom_simulator.py --loom-id 1 --pattern dragon_cloud --tension-profile normal
    python loom_simulator.py --loom-id 2 --pattern peony_brocade --tension-profile high_tension
"""

import argparse
import json
import math
import os
import random
import sys
import time
import requests
from datetime import datetime

PATTERNS = {
    "dragon_cloud": {
        "name": "云龙纹大花",
        "cycle_length": 240,
        "motif_positions": [2, 5, 10, 13],
        "harness_count": 4,
        "border_width_ratio": 12,
    },
    "peony_brocade": {
        "name": "牡丹锦缎",
        "cycle_length": 180,
        "motif_positions": [1, 4, 7, 11, 14],
        "harness_count": 8,
        "border_width_ratio": 10,
    },
    "plain_silk": {
        "name": "素缎平纹",
        "cycle_length": 2,
        "motif_positions": [],
        "harness_count": 2,
        "border_width_ratio": 15,
    },
    "satin_8": {
        "name": "八枚缎纹",
        "cycle_length": 8,
        "motif_positions": [0, 3, 5, 7],
        "harness_count": 8,
        "border_width_ratio": 10,
    },
}

TENSION_PROFILES = {
    "normal": {
        "name": "正常织造",
        "base_tension": 2.2,
        "tension_noise": 0.15,
        "friction_mu": 0.28,
        "heddle_eye_friction": 0.15,
        "reed_dent_friction": 0.12,
        "back_beam_wrap_angle": 1.57,
        "break_probability": 0.005,
    },
    "high_tension": {
        "name": "高张力织造",
        "base_tension": 3.8,
        "tension_noise": 0.25,
        "friction_mu": 0.35,
        "heddle_eye_friction": 0.20,
        "reed_dent_friction": 0.18,
        "back_beam_wrap_angle": 1.57,
        "break_probability": 0.02,
    },
    "loose_warp": {
        "name": "松经织造",
        "base_tension": 1.2,
        "tension_noise": 0.35,
        "friction_mu": 0.18,
        "heddle_eye_friction": 0.10,
        "reed_dent_friction": 0.08,
        "back_beam_wrap_angle": 1.20,
        "break_probability": 0.001,
    },
    "worn_loom": {
        "name": "老旧织机",
        "base_tension": 2.2,
        "tension_noise": 0.40,
        "friction_mu": 0.45,
        "heddle_eye_friction": 0.25,
        "reed_dent_friction": 0.20,
        "back_beam_wrap_angle": 1.57,
        "break_probability": 0.015,
    },
}


class LoomSensorSimulator:
    def __init__(self, loom_id, api_base='http://localhost:8080/api',
                 total_warp=1200, interval=1.0,
                 break_prob=None, misalign_prob=0.002,
                 density_target=60.0, friction_mu=None,
                 pattern_name='dragon_cloud',
                 tension_profile_name='normal',
                 config_file=None):
        self.loom_id = loom_id
        self.api_base = api_base.rstrip('/')
        self.total_warp = total_warp
        self.visual_warp = 120
        self.interval = interval
        self.misalign_prob = misalign_prob
        self.density_target = density_target

        if config_file and os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                if 'patterns' in config and pattern_name in config['patterns']:
                    self._apply_pattern_config(config['patterns'][pattern_name])
                else:
                    self._apply_pattern_config(PATTERNS.get(pattern_name, PATTERNS['dragon_cloud']))
                if 'tension_profiles' in config and tension_profile_name in config['tension_profiles']:
                    self._apply_tension_config(config['tension_profiles'][tension_profile_name], break_prob, friction_mu)
                else:
                    self._apply_tension_config(TENSION_PROFILES.get(tension_profile_name, TENSION_PROFILES['normal']), break_prob, friction_mu)
        else:
            self._apply_pattern_config(PATTERNS.get(pattern_name, PATTERNS['dragon_cloud']))
            self._apply_tension_config(TENSION_PROFILES.get(tension_profile_name, TENSION_PROFILES['normal']), break_prob, friction_mu)

        self.pattern_position = 0
        self.fabric_progress = 0.0
        self.target_progress = 1.0
        self.broken_warps = set()
        self.misaligned = False
        self.running = True

    def _apply_pattern_config(self, cfg):
        self.pattern_cycle = cfg.get('cycle_length', 240)
        self.motif_positions = cfg.get('motif_positions', [2, 5, 10, 13])
        self.harness_count = cfg.get('harness_count', 4)
        self.border_width_ratio = cfg.get('border_width_ratio', 12)
        self.pattern_name = cfg.get('name', 'unknown')

    def _apply_tension_config(self, cfg, break_prob_override, friction_mu_override):
        self.base_tension = cfg.get('base_tension', 2.2)
        self.tension_noise = cfg.get('tension_noise', 0.15)
        self.friction_mu = friction_mu_override if friction_mu_override is not None else cfg.get('friction_mu', 0.28)
        self.heddle_eye_friction = cfg.get('heddle_eye_friction', 0.15)
        self.reed_dent_friction = cfg.get('reed_dent_friction', 0.12)
        self.back_beam_wrap_angle = cfg.get('back_beam_wrap_angle', 1.57)
        self.break_prob = break_prob_override if break_prob_override is not None else cfg.get('break_probability', 0.005)
        self.tension_profile_name = cfg.get('name', 'unknown')

    def _generate_warp_tension_array(self):
        tensions = []
        base_t = self.base_tension + random.uniform(-self.tension_noise, self.tension_noise)
        shed = self._generate_shed_opening()
        border_width = max(1, self.visual_warp // self.border_width_ratio)
        for i in range(self.visual_warp):
            actual_idx = int(i * self.total_warp / self.visual_warp)
            if actual_idx in self.broken_warps:
                tensions.append(0.02)
                continue
            normalized_pos = i / (self.visual_warp - 1)
            position_factor = 1.0 + 0.08 * math.sin(2 * math.pi * normalized_pos * 3) + 0.04 * math.cos(2 * math.pi * normalized_pos * 7)
            dist_to_left = i
            dist_to_right = (self.visual_warp - 1) - i
            dist_to_edge = min(dist_to_left, dist_to_right)
            if dist_to_edge < border_width:
                border_factor = 1.0 + 0.18 * (1 - dist_to_edge / border_width)
            else:
                border_factor = 1.0
            shed_val = shed[i]
            shed_factor = 1.12 if shed_val == 1 else 0.90
            cumulative_wear = 1.0 + 0.06 * math.log(1 + (self.visual_warp - i))
            capstan_factor = math.exp(self.friction_mu * self.back_beam_wrap_angle * (0.8 + 0.4 * normalized_pos))
            heddle_reed_factor = 1.0 + self.heddle_eye_friction * 0.25 + self.reed_dent_friction * 0.15
            random_noise = 1.0 + random.gauss(0, 0.04)
            t = base_t * position_factor * border_factor * shed_factor * cumulative_wear * capstan_factor * heddle_reed_factor * random_noise
            t = max(0.01, min(6.5, t))
            tensions.append(round(t, 3))
        return tensions

    def _generate_shed_opening(self):
        shed = []
        p = self.pattern_position % self.pattern_cycle
        harnesses = self.harness_count
        for i in range(self.visual_warp):
            harness_group = i % harnesses
            phase = (p + harness_group) % harnesses
            val = 1 if (phase == 0 or phase == harnesses // 2) else 0
            motif_start = max(0, self.visual_warp // 4)
            motif_end = min(self.visual_warp, 3 * self.visual_warp // 4)
            if motif_start <= i <= motif_end:
                motif_pos = (i - motif_start + p // 6) % max(1, len(self.motif_positions) * 4)
                if motif_pos in self.motif_positions:
                    val = 1
            shed.append(val)
        border_width = max(1, self.visual_warp // self.border_width_ratio)
        for i in range(min(border_width, self.visual_warp)):
            shed[i] = 1 if (p + i % 2) % 2 == 0 else 0
        for i in range(max(0, self.visual_warp - border_width), self.visual_warp):
            shed[i] = 1 if (p + (self.visual_warp - 1 - i) % 2) % 2 == 0 else 0
        return shed

    def _maybe_introduce_faults(self):
        if random.random() < self.break_prob:
            if len(self.broken_warps) < 5:
                idx = random.randint(0, self.total_warp - 1)
                if idx not in self.broken_warps:
                    self.broken_warps.add(idx)
                    print(f"  [!] 经纱 #{idx} 断头！断纱总数: {len(self.broken_warps)}")
        if random.random() < self.misalign_prob and not self.misaligned:
            self.misaligned = True
            jump = random.randint(5, 15)
            self.pattern_position += jump
            print(f"  [!] 花本错位！跳跃偏移 {jump} 格")

    def generate_reading(self):
        self._maybe_introduce_faults()
        warp_array = self._generate_warp_tension_array()
        valid = [t for t in warp_array if t > 0.1]
        avg_tension = sum(valid) / len(valid) if valid else 0.5
        base_density = self.density_target
        density_noise = random.gauss(0, 1.8)
        if self.misaligned:
            density_noise += 12
        weft_density = round(base_density + density_noise, 2)
        self.pattern_position += 1
        if self.misaligned and random.random() < 0.15:
            self.misaligned = False
            print(f"  [i] 花本恢复对齐")
        step = 0.0008 + random.uniform(-0.0001, 0.0003)
        self.fabric_progress = min(self.target_progress, self.fabric_progress + step)
        shed = self._generate_shed_opening()
        return {
            "loomId": self.loom_id,
            "warpTension": round(avg_tension, 3),
            "weftDensity": weft_density,
            "patternPosition": self.pattern_position,
            "fabricProgress": round(self.fabric_progress, 5),
            "timestamp": datetime.now().isoformat(),
            "warpTensionArray": warp_array,
            "shedOpeningArray": shed
        }

    def send_data(self, data):
        url = f"{self.api_base}/sensor/ingest"
        try:
            resp = requests.post(url, json=data, timeout=5)
            if resp.status_code in (200, 201):
                return True, resp.status_code
            else:
                return False, resp.status_code
        except requests.exceptions.RequestException as e:
            return False, str(e)

    def run(self):
        print("=" * 70)
        print("  Nanjing Yunjin Jacquard Loom - Sensor Simulator")
        print("=" * 70)
        print(f"  Loom ID         : #{self.loom_id}")
        print(f"  Total Warps     : {self.total_warp}")
        print(f"  Interval        : {self.interval}s")
        print(f"  Pattern         : {self.pattern_name} (cycle={self.pattern_cycle})")
        print(f"  Tension Profile : {self.tension_profile_name} (base={self.base_tension}N)")
        print(f"  Target Density  : {self.density_target} ends/cm")
        print(f"  Break Prob.     : {self.break_prob * 100:.2f}%")
        print(f"  Friction Mu     : {self.friction_mu}")
        print(f"  API Base        : {self.api_base}")
        print("=" * 70)
        print()
        count = 0
        try:
            while self.running:
                data = self.generate_reading()
                ok, info = self.send_data(data)
                count += 1
                status = "[OK]" if ok else "[X]"
                broken_n = len(self.broken_warps)
                mis = "  [!MISALIGN]" if self.misaligned else ""
                ts_str = data['timestamp'].split('T')[1][:8]
                line = (
                    f"[{count:05d}] {status} "
                    f"T:{ts_str} | "
                    f"Tension={data['warpTension']:5.2f}N | "
                    f"Density={data['weftDensity']:5.1f} | "
                    f"Pattern={data['patternPosition']:4d} | "
                    f"Progress={data['fabricProgress'] * 100:5.2f}%"
                )
                if broken_n:
                    line += f" | Broken={broken_n}"
                line += mis
                print(line)
                if not ok:
                    print(f"       -> Send failed: {info}")
                sys.stdout.flush()
                time.sleep(self.interval)
                if data['fabricProgress'] >= self.target_progress * 0.999:
                    print("\n[Done] Fabric 100% complete. Starting new bolt...\n")
                    self.fabric_progress = 0.0
                    self.pattern_position = 0
                    self.broken_warps.clear()
                    time.sleep(2)
        except KeyboardInterrupt:
            print("\n\n[Stop] Simulator stopped by user.")


def main():
    parser = argparse.ArgumentParser(description="Yunjin Loom Sensor Simulator")
    parser.add_argument('--loom-id', type=int, default=1, help='Loom ID (default 1)')
    parser.add_argument('--interval', type=float, default=1.0, help='Report interval in seconds')
    parser.add_argument('--total-warp', type=int, default=1200, help='Total warp threads')
    parser.add_argument('--break-prob', type=float, default=None, help='Warp break probability per step (overrides profile)')
    parser.add_argument('--misalign-prob', type=float, default=0.002, help='Pattern misalignment probability')
    parser.add_argument('--density', type=float, default=60.0, help='Target weft density')
    parser.add_argument('--api', type=str, default='http://localhost:8080/api', help='Backend API base URL')
    parser.add_argument('--friction-mu', type=float, default=None, help='Warp friction coefficient mu (overrides profile)')
    parser.add_argument('--pattern', type=str, default='dragon_cloud',
                        choices=list(PATTERNS.keys()),
                        help='Pattern preset: ' + ', '.join(PATTERNS.keys()))
    parser.add_argument('--tension-profile', type=str, default='normal',
                        choices=list(TENSION_PROFILES.keys()),
                        help='Tension profile: ' + ', '.join(TENSION_PROFILES.keys()))
    parser.add_argument('--config', type=str, default=None, help='Path to simulator_config.json')

    args = parser.parse_args()

    sim = LoomSensorSimulator(
        loom_id=args.loom_id,
        api_base=args.api,
        total_warp=args.total_warp,
        interval=args.interval,
        break_prob=args.break_prob,
        misalign_prob=args.misalign_prob,
        density_target=args.density,
        friction_mu=args.friction_mu,
        pattern_name=args.pattern,
        tension_profile_name=args.tension_profile,
        config_file=args.config,
    )
    sim.run()


if __name__ == '__main__':
    main()
