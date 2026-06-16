FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir requests paho-mqtt
COPY loom_simulator.py .
COPY simulator_config.json ./config.json
ENTRYPOINT ["python", "loom_simulator.py"]
CMD ["--loom-id", "1", "--api", "http://backend:8080/api"]
