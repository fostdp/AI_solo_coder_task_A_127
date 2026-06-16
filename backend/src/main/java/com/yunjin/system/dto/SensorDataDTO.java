package com.yunjin.system.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SensorDataDTO {
    private Long loomId;
    private Double warpTension;
    private Double weftDensity;
    private Integer patternPosition;
    private Double fabricProgress;
    private LocalDateTime timestamp;
    private double[] warpTensionArray;
    private int[] shedOpeningArray;
}
