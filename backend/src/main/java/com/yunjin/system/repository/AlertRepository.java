package com.yunjin.system.repository;

import com.yunjin.system.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByLoomIdAndResolvedFalseOrderByCreatedAtDesc(Long loomId);
    List<Alert> findByResolvedFalseOrderByCreatedAtDesc();
    List<Alert> findByLoomIdOrderByCreatedAtDesc(Long loomId);
}
