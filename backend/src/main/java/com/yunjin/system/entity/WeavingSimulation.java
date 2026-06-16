package com.yunjin.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "weaving_simulation")
public class WeavingSimulation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loom_id", unique = true, nullable = false)
    private Long loomId;

    @Column(name = "current_weft_row")
    private Integer currentWeftRow = 0;

    @Column(name = "shed_state", columnDefinition = "TEXT")
    private String shedState;

    @Column(name = "interlacement_matrix", columnDefinition = "TEXT")
    private String interlacementMatrix;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.lastUpdated = LocalDateTime.now();
    }
}
