package com.yunjin.system.event;

import org.springframework.context.ApplicationEvent;

public class SimulationStepEvent extends ApplicationEvent {
    private final Long loomId;
    private final int weftRow;
    private final int[] shedOpening;

    public SimulationStepEvent(Object source, Long loomId, int weftRow, int[] shedOpening) {
        super(source);
        this.loomId = loomId;
        this.weftRow = weftRow;
        this.shedOpening = shedOpening;
    }

    public Long getLoomId() { return loomId; }
    public int getWeftRow() { return weftRow; }
    public int[] getShedOpening() { return shedOpening; }
}
