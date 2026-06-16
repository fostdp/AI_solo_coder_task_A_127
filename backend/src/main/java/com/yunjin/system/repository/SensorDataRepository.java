package com.yunjin.system.repository;

import com.yunjin.system.entity.SensorData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SensorDataRepository extends JpaRepository<SensorData, Long> {
    List<SensorData> findByLoomIdOrderByTimestampDesc(Long loomId);

    List<SensorData> findByLoomIdAndTimestampBetweenOrderByTimestamp(Long loomId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT s FROM SensorData s WHERE s.loomId = :loomId ORDER BY s.timestamp DESC LIMIT :n")
    List<SensorData> findTopNByLoomId(Long loomId, int n);
}
