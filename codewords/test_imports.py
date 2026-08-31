try:
    import sentence_transformers
    print("sentence_transformers imported successfully")
except ImportError as e:
    print(f"ImportError: {e}")

try:
    import pandas
    print("pandas imported successfully")
except ImportError as e:
    print(f"ImportError: {e}")

try:
    import torch
    print("torch imported successfully")
except ImportError as e:
    print(f"ImportError: {e}")
