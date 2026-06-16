package com.yunjin.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sensor_data", indexes = {
    @Index(name = "idx_sensor_data_loom_id", columnList = "loom_id"),
    @Index(name = "idx_sensor_data_timestamp", columnList = "timestamp")
})
public class SensorData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loom_id", nullable = false)
    private Long loomId;

    @Column(name = "warp_tension", nullable = false)
    private Double warpTension;

    @Column(name = "weft_density", nullable = false)
    private Double weftDensity;

    @Column(name = "pattern_position", nullable = false)
    private Integer patternPosition;

    @Column(name = "fabric_progress", nullable = false)
    private Double fabricProgress;

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Column(name = "warp_tension_array", columnDefinition = "TEXT")
    private String warpTensionArray;

    @Column(name = "shed_opening_array", columnDefinition = "TEXT")
    private String shedOpeningArray;
}
