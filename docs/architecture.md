graph LR
    %% Direction: Left to Right

    %% Define nodes with descriptive labels
    user([👤 User])
    loadbalancer{{"🔄 NGINX Load Balancer"}}
    cdn{{"🌍 CDN"}}
    result([📹 Processed Video])

    %% AWS Environment
    subgraph aws_env ["AWS (Prod)"]
        direction TB
        aws_cluster[["🌐 EKS"]]
        aws_compute_aws[[🖥️ Compute Nodes]]
        aws_storage[(📦 S3)]
        aws_redis[(🗄️ Redis)]
        aws_autoscaler>"📈 AutoScaler"]
        aws_security{"🔒 IAM & Firewall"}
    end

    %% GCP Environment
    subgraph gcp_env ["GCP (DR)"]
        direction TB
        gcp_cluster[["🌐 GKE"]]
        gcp_compute_gcp[[🖥️ Compute Nodes]]
        gcp_storage[(📦 GCS)]
        gcp_redis[(🗄️ Redis)]
        gcp_autoscaler>"📈 AutoScaler"]
        gcp_security{"🔒 IAM & Firewall"}
    end

    %% Common processing pipeline
    subgraph common_pipeline ["🔄 Processing Pipeline"]
        direction TB
        input_handler(📥 Input Handler)
        job_queue(📋 Job Queue)
        worker_pool(⚙️ Worker Pool)
        ffmpeg(🎬 FFmpeg)
        error_handler(⚠️ Error Handler)
        retry_logic(🔄 Retry Logic)
    end

    %% Supporting infrastructure
    subgraph support ["🛠️ Infrastructure"]
        direction TB
        cicd{{"🔄 CI/CD"}}
        monitoring{{"📊 Monitoring"}}
        logging{{"📝 Logging (ELK)"}}
        tracing{{"🔍 Tracing (Jaeger)"}}
        terraform{{"📝 IaC"}}
        security{{"🔒 Security Policies"}}
    end

    %% Main flow connections
    user --> loadbalancer
    loadbalancer -- "AWS route" --> aws_cluster
    loadbalancer -- "GCP route" --> gcp_cluster

    %% Pipeline connections
    aws_cluster --> common_pipeline
    gcp_cluster --> common_pipeline

    %% Pipeline internal flow
    input_handler --> job_queue
    job_queue --> worker_pool
    worker_pool --> ffmpeg
    ffmpeg --> error_handler
    error_handler --> retry_logic
    retry_logic --> job_queue

    %% Compute node connections
    aws_cluster --> aws_compute_aws
    gcp_cluster --> gcp_compute_gcp
    aws_compute_aws --> common_pipeline
    gcp_compute_gcp --> common_pipeline

    %% Storage connections
    ffmpeg --> aws_storage
    ffmpeg --> gcp_storage

    %% Cross-cloud synchronization
    aws_storage <--> gcp_storage

    %% Redis cache connections (dotted lines)
    aws_cluster -.-> aws_redis
    gcp_cluster -.-> gcp_redis

    %% CDN and result flow
    aws_storage --> cdn
    gcp_storage --> cdn
    cdn --> result
    result --> user

    %% Supporting infrastructure connections
    cicd -.-> aws_cluster
    cicd -.-> gcp_cluster
    monitoring -.-> aws_cluster
    monitoring -.-> gcp_cluster
    logging -.-> aws_cluster
    logging -.-> gcp_cluster
    tracing -.-> aws_cluster
    tracing -.-> gcp_cluster
    terraform -.-> aws_cluster
    terraform -.-> gcp_cluster
    security -.-> aws_security
    security -.-> gcp_security

    %% Enhanced styling with semantic shapes
    classDef user fill:#f9f9ff,stroke:#333,stroke-width:2px;
    classDef loadbalancer fill:#cce6ff,stroke:#0066cc,stroke-width:2px;
    classDef aws fill:#ff9933,stroke:#cc6600,stroke-width:2px,color:black;
    classDef gcp fill:#4285F4,stroke:#1a5fb4,stroke-width:2px,color:white;
    classDef pipeline fill:#d4f7d4,stroke:#339933,stroke-width:2px;
    classDef storage fill:#e6e6ff,stroke:#6666ff,stroke-width:2px;
    classDef cache fill:#f0f7ff,stroke:#3399ff,stroke-width:2px,stroke-dasharray:5 5;
    classDef support fill:#e6e6e6,stroke:#666,stroke-width:1px;
    classDef cdn fill:#cc99ff,stroke:#663399,stroke-width:2px;
    classDef result fill:#f9f9ff,stroke:#333,stroke-width:2px;
    classDef compute fill:#cce0ff,stroke:#3366cc,stroke-width:2px;
    classDef security fill:#ff9999,stroke:#cc0000,stroke-width:2px;
    classDef aws_subgraph fill:#ff993320,stroke:#ff9933,stroke-width:2px;
    classDef gcp_subgraph fill:#4285F420,stroke:#4285F4,stroke-width:2px;

    %% Apply styles
    class user,result user
    class loadbalancer loadbalancer
    class aws_cluster,aws_storage,aws_redis,aws_autoscaler,aws_security aws
    class gcp_cluster,gcp_storage,gcp_redis,gcp_autoscaler,gcp_security gcp
    class common_pipeline,input_handler,job_queue,worker_pool,ffmpeg,error_handler,retry_logic pipeline
    class aws_storage,gcp_storage storage
    class aws_redis,gcp_redis cache
    class support,cicd,monitoring,logging,tracing,terraform,security support
    class cdn cdn
    class aws_compute_aws,gcp_compute_gcp compute
    class aws_security,gcp_security security
    class aws_env aws_subgraph
    class gcp_env gcp_subgraph