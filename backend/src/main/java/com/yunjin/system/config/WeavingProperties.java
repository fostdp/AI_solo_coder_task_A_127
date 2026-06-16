package com.yunjin.system.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "weaving")
@Data
public class WeavingProperties {
    private Simulation simulation = new Simulation();
    private Alert alert = new Alert();

    @Data
    public static class Simulation {
        private int defaultWarpCount = 1200;
        private double defaultWeftDensity = 60.0;
        private double tensionBase = 2.2;
        private double frictionCoefficient = 0.28;
        private double backBeamWrapAngle = 1.57;
        private double heddleEyeFriction = 0.15;
        private double reedDentFriction = 0.12;
        private double borderEnhancement = 0.18;
        private double shedUpperFactor = 1.12;
        private double shedLowerFactor = 0.90;
        private double wearCoefficient = 0.06;
        private double tensionMin = 0.01;
        private double tensionMax = 6.5;
        private int initialWeftRows = 500;
        private int maxWeftRows = 10000;
        private boolean autoAdvance = false;
    }

    @Data
    public static class Alert {
        private double warpTensionMin = 0.5;
        private double warpTensionMax = 5.0;
        private int patternMisalignmentThreshold = 3;
        private double warpBreakEpsilon = 0.05;
        private double weftDensityTolerance = 0.15;
        private int patternJumpWindow = 5;
    }
}
