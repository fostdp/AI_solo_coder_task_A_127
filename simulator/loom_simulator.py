#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古代云锦织机传感器模拟器
=====================
模拟南京云锦大花楼织机每台织机每秒上报数据
- 经纱张力 (warpTension)
- 纬纱密度 (weftDensity)
- 花本位置 (patternPosition)
- 织物进度 (fabricProgress)

使用:
    python loom_simulator.py --loom-id 1 --interval 1.0
"""

import argparse
import json
import random
import time
import math
import sys
import requests
from datetime import datetime


class LoomSensorSimulator:
    def __init__(self, loom_id, api_base='http://localhost:8080/api',
                 total_warp=1200, interval=1.0,
                 break_prob=0.005, misalign_prob=0.002,
                 density_target=60.0, friction_mu=0.28):
        self.loom_id = loom_id
        self.api_base = api_base.rstrip('/')
        self.total_warp = total_warp
        self.visual_warp = 120
        self.interval = interval
        self.break_prob = break_prob
        self.misalign_prob = misalign_prob
        self.density_target = density_target
        self.friction_mu = friction_mu
        self.back_beam_wrap_angle = 1.57
        self.heddle_eye_friction = 0.15
        self.reed_dent_friction = 0.12

        self.pattern_position = 0
        self.pattern_cycle = 240
        self.fabric_progress = 0.0
        self.target_progress = 1.0
        self.broken_warps = set()
        self.misaligned = False
        self.running = True

    def _generate_warp_tension_array(self):
        tensions = []
        base_tension = 2.2 + random.uniform(-0.15, 0.15)
        shed = self._generate_shed_opening()
        border_width = max(1, self.visual_warp // 12)
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
            if shed_val == 1:
                shed_factor = 1.12
            else:
                shed_factor = 0.90
            cumulative_wear = 1.0 + 0.06 * math.log(1 + (self.visual_warp - i))
            capstan_factor = math.exp(self.friction_mu * self.back_beam_wrap_angle * (0.8 + 0.4 * normalized_pos))
            heddle_reed_factor = 1.0 + self.heddle_eye_friction * 0.25 + self.reed_dent_friction * 0.15
            random_noise = 1.0 + random.gauss(0, 0.04)
            t = base_tension * position_factor * border_factor * shed_factor * cumulative_wear * capstan_factor * heddle_reed_factor * random_noise
            t = max(0.01, min(6.5, t))
            tensions.append(round(t, 3))
        return tensions

    def _generate_shed_opening(self):
        shed = []
        p = self.pattern_position % self.pattern_cycle
        for i in range(self.visual_warp):
            base = (i + p // 4) % 8
            val = 1 if base < 4 else 0
            if 20 <= i <= 80:
                pat = (i // 3 + p // 6) % 5
                val = 1 if pat < 3 else 0
            shed.append(val)
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
        print(f"  Loom ID        : #{self.loom_id}")
        print(f"  Total Warps    : {self.total_warp}")
        print(f"  Interval       : {self.interval}s")
        print(f"  Target Density : {self.density_target} ends/cm")
        print(f"  Break Prob.    : {self.break_prob * 100:.2f}%")
        print(f"  Misalign Prob. : {self.misalign_prob * 100:.3f}%")
        print(f"  Friction Mu    : {self.friction_mu}")
        print(f"  Border Enhanc. : +18% (width={max(1, self.visual_warp // 12)})")
        print(f"  API Base       : {self.api_base}")
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
    parser.add_argument('--break-prob', type=float, default=0.005, help='Warp break probability per step')
    parser.add_argument('--misalign-prob', type=float, default=0.002, help='Pattern misalignment probability')
    parser.add_argument('--density', type=float, default=60.0, help='Target weft density')
    parser.add_argument('--api', type=str, default='http://localhost:8080/api', help='Backend API base URL')
    parser.add_argument('--friction-mu', type=float, default=0.28, help='Warp friction coefficient mu')

    args = parser.parse_args()

    sim = LoomSensorSimulator(
        loom_id=args.loom_id,
        api_base=args.api,
        total_warp=args.total_warp,
        interval=args.interval,
        break_prob=args.break_prob,
        misalign_prob=args.misalign_prob,
        density_target=args.density,
        friction_mu=args.friction_mu
    )
    sim.run()


if __name__ == '__main__':
    main()
