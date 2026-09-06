---
library_name: transformers.js
base_model: google/gemma-4-E2B-it
license: apache-2.0
license_link: https://ai.google.dev/gemma/docs/gemma_4_license
tags:
- conversational
- image-text-to-text
pipeline_tag: any-to-any
---
<div align="center">
  <img src=https://ai.google.dev/gemma/images/gemma4_banner.png>
</div>


<p align="center">
    <a href="https://huggingface.co/collections/google/gemma-4" target="_blank">Hugging Face</a> |
    <a href="https://github.com/google-gemma" target="_blank">GitHub</a> |
    <a href="https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/" target="_blank">Launch Blog</a> |
    <a href="https://ai.google.dev/gemma/docs/core" target="_blank">Documentation</a>
    <br>
    <b>License</b>: <a href="https://ai.google.dev/gemma/docs/gemma_4_license" target="_blank">Apache 2.0</a> | <b>Authors</b>: <a href="https://deepmind.google/models/gemma/" target="_blank">Google DeepMind</a>
</p>

Gemma is a family of open models built by Google DeepMind. Gemma 4 models are multimodal, handling text and image input (with audio supported on small models) and generating text output. This release includes open-weights models in both pre-trained and instruction-tuned variants. Gemma 4 features a context window of up to 256K tokens and maintains multilingual support in over 140 languages. 

Featuring both Dense and Mixture-of-Experts (MoE) architectures, Gemma 4 is well-suited for tasks like text generation, coding, and reasoning. The models are available in four distinct sizes: **E2B**, **E4B**, **26B A4B**, and **31B**. Their diverse sizes make them deployable in environments ranging from high-end phones to laptops and servers, democratizing access to state-of-the-art AI.

Gemma 4 introduces key **capability and architectural advancements**:

* **Reasoning** – All models in the family are designed as highly capable reasoners, with configurable thinking modes.

* **Extended Multimodalities** – Processes Text, Image with variable aspect ratio and resolution support (all models), Video, and Audio (featured natively on the E2B and E4B models).

* **Diverse & Efficient Architectures** – Offers Dense and Mixture-of-Experts (MoE) variants of different sizes for scalable deployment.

* **Optimized for On-Device** – Smaller models are specifically designed for efficient local execution on laptops and mobile devices.

* **Increased Context Window** – The small models feature a 128K context window, while the medium models support 256K.

* **Enhanced Coding & Agentic Capabilities** – Achieves notable improvements in coding benchmarks alongside native function-calling support, powering highly capable autonomous agents.

* **Native System Prompt Support** – Gemma 4 introduces native support for the `system` role, enabling more structured and controllable conversations.

## **Models Overview**

Gemma 4 models are designed to deliver frontier-level performance at each size, targeting deployment scenarios from mobile and edge devices (E2B, E4B) to consumer GPUs and workstations (26B A4B, 31B). They are well-suited for reasoning, agentic workflows, coding, and multimodal understanding.

The models employ a hybrid attention mechanism that interleaves local sliding window attention with full global attention, ensuring the final layer is always global. This hybrid design delivers the processing speed and low memory footprint of a lightweight model without sacrificing the deep awareness required for complex, long-context tasks. To optimize memory for long contexts, global layers feature unified Keys and Values, and apply Proportional RoPE (p-RoPE). 

### Dense Models

| Property | E2B | E4B | 31B Dense |
| :---- | :---- | :---- | :---- |
| **Total Parameters** | 2.3B effective (5.1B with embeddings) | 4.5B effective (8B with embeddings) | 30.7B |
| **Layers** | 35 | 42 | 60 |
| **Sliding Window** | 512 tokens | 512 tokens | 1024 tokens |
| **Context Length** | 128K tokens | 128K tokens | 256K tokens  |
| **Vocabulary Size** | 262K | 262K | 262K |
| **Supported Modalities** | Text, Image, Audio | Text, Image, Audio | Text, Image |
| **Vision Encoder Parameters** | *~150M* | *~150M* | *~550M* |
| **Audio Encoder Parameters** | *~300M* | *~300M* | No Audio |

The "E" in E2B and E4B stands for "effective" parameters. The smaller models incorporate Per-Layer Embeddings (PLE) to maximize parameter efficiency in on-device deployments. Rather than adding more layers or parameters to the model, PLE gives each decoder layer its own small embedding for every token. These embedding tables are large but are only used for quick lookups, which is why the effective parameter count is much smaller than the total.

### Mixture-of-Experts (MoE) Model

| Property | 26B A4B MoE |
| :---- | :---- |
| **Total Parameters** | 25.2B |
| **Active Parameters** | 3.8B |
| **Layers** | 30 |
| **Sliding Window** | 1024 tokens |
| **Context Length** | 256K tokens |
| **Vocabulary Size** | 262K |
| **Expert Count** | 8 active / 128 total and 1 shared |
| **Supported Modalities** | Text, Image |
| **Vision Encoder Parameters** | *~550M* |

The "A" in 26B A4B stands for "active parameters" in contrast to the total number of parameters the model contains. By only activating a 4B subset of parameters during inference, the Mixture-of-Experts model runs much faster than its 26B total might suggest. This makes it an excellent choice for fast inference compared to the dense 31B model since it runs almost as fast as a 4B-parameter model.

## **Benchmark Results** 

These models were evaluated against a large collection of different datasets and metrics to cover different aspects of text generation. Evaluation results marked in the table are for instruction-tuned models.

|  | Gemma 4  31B | Gemma 4  26B A4B | Gemma 4  E4B | Gemma 4  E2B | Gemma 3  27B (no think) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| MMLU Pro | 85.2% | 82.6% | 69.4% | 60.0% | 67.6% |
| AIME 2026 no tools | 89.2% | 88.3% | 42.5% | 37.5% | 20.8% |
| LiveCodeBench v6 | 80.0% | 77.1% | 52.0% | 44.0% | 29.1% |
| Codeforces ELO | 2150 | 1718 | 940 | 633 | 110 |
| GPQA Diamond | 84.3% | 82.3% | 58.6% | 43.4% | 42.4% |
| Tau2 (average over 3) | 76.9% | 68.2% | 42.2% | 24.5% | 16.2% |
| HLE no tools | 19.5% | 8.7% | - | - | - |
| HLE with search | 26.5% | 17.2% | - | - | - |
| BigBench Extra Hard | 74.4% | 64.8% | 33.1% | 21.9% | 19.3% |
| MMMLU | 88.4% | 86.3% | 76.6% | 67.4% | 70.7% |
| **Vision** |  |  |  |  |  |
| MMMU Pro | 76.9% | 73.8% | 52.6% | 44.2% | 49.7% |
| OmniDocBench 1.5 (average edit distance, lower is better) | 0.131 | 0.149 | 0.181 | 0.290 | 0.365 |
| MATH-Vision | 85.6% | 82.4% | 59.5% | 52.4% | 46.0% |
| MedXPertQA MM | 61.3% | 58.1% | 28.7% | 23.5% | - |
| **Audio** |  |  |  |  |  |
| CoVoST | - | - | 35.54 | 33.47 | - |
| FLEURS (lower is better) | - | - | 0.08 | 0.09 | - |
| **Long Context** |  |  |  |  |  |
| MRCR v2 8 needle 128k (average) | 66.4% | 44.1%  | 25.4% | 19.1% | 13.5% |

## **Core Capabilities**

Gemma 4 models handle a broad range of tasks across text, vision, and audio. Key capabilities include:

* **Thinking** – Built-in reasoning mode that lets the model think step-by-step before answering.
* **Long Context** – Context windows of up to 128K tokens (E2B/E4B) and 256K tokens (26B A4B/31B).
* **Image Understanding** – Object detection, Document/PDF parsing, screen and UI understanding, chart comprehension, OCR (including multilingual), handwriting recognition, and pointing. Images can be processed at variable aspect ratios and resolutions.
* **Video Understanding** – Analyze video by processing sequences of frames.
* **Interleaved Multimodal Input** – Freely mix text and images in any order within a single prompt.
* **Function Calling** – Native support for structured tool use, enabling agentic workflows.
* **Coding** – Code generation, completion, and correction.
* **Multilingual** – Out-of-the-box support for 35+ languages, pre-trained on 140+ languages.
* **Audio** (E2B and E4B only) – Automatic speech recognition (ASR) and speech-to-translated-text translation across multiple languages.

## **Best Practices**

For the best performance, use these configurations and best practices:

### 1. Sampling Parameters

Use the following standardized sampling configuration across all use cases:

* `temperature=1.0`  
* `top_p=0.95`  
* `top_k=64`

### 2. Thinking Mode Configuration

Compared to Gemma 3, the models use standard `system`, `assistant`, and `user` roles. To properly manage the thinking process, use the following control tokens:

* **Trigger Thinking:** Thinking is enabled by including the `<|think|>` token at the start of the system prompt. To disable thinking, remove the token.   
* **Standard Generation:** When thinking is enabled, the model will output its internal reasoning followed by the final answer using this structure:  
  `<|channel>thought\n`**[Internal reasoning]**`<channel|>`  
* **Disabled Thinking Behavior:** For all models except for the E2B and E4B variants, if thinking is disabled, the model will still generate the tags but with an empty thought block:  
  `<|channel>thought\n<channel|>`**[Final answer]**

> [!Note]
> Note that many libraries like Transformers and llama.cpp handle the complexities of the chat template for you.

### 3. Multi-Turn Conversations

* **No Thinking Content in History**: In multi-turn conversations, the historical model output should only include the final response. Thoughts from previous model turns must *not be added* before the next user turn begins.

### 4. Modality order

* For optimal performance with multimodal inputs, place image and/or audio content **before** the text in your prompt. 

### 5. Variable Image Resolution

Aside from variable aspect ratios, Gemma 4 supports variable image resolution through a configurable visual token budget, which controls how many tokens are used to represent an image. A higher token budget preserves more visual detail at the cost of additional compute, while a lower budget enables faster inference for tasks that don't require fine-grained understanding.

* The supported token budgets are: **70**, **140**, **280**, **560**, and **1120**.  
  * Use *lower budgets* for classification, captioning, or video understanding, where faster inference and processing many frames outweigh fine-grained detail.   
  * Use *higher budgets* for tasks like OCR, document parsing, or reading small text.

### 6. Audio

Use the following prompt structures for audio processing:

* **Audio Speech Recognition (ASR)**

```text
Transcribe the following speech segment in {LANGUAGE} into {LANGUAGE} text.

Follow these specific instructions for formatting the answer:
* Only output the transcription, with no newlines.
* When transcribing numbers, write the digits, i.e. write 1.7 and not one point seven, and write 3 instead of three.
```

* **Automatic Speech Translation (AST)**

```text
Transcribe the following speech segment in {SOURCE_LANGUAGE}, then translate it into {TARGET_LANGUAGE}.
When formatting the answer, first output the transcription in {SOURCE_LANGUAGE}, then one newline, then output the string '{TARGET_LANGUAGE}: ', then the translation in {TARGET_LANGUAGE}.
```

### 7. Audio and Video Length

All models support image inputs and can process videos as frames whereas the E2B and E4B models also support audio inputs. Audio supports a maximum length of 30 seconds. Video supports a maximum of 60 seconds assuming the images are processed at one frame per second.

## Usage

### Transformers.js (JavaScript)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@huggingface/transformers) using:

```sh
npm i @huggingface/transformers
```

You can then use the model as follows:

```js
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  load_image,
  read_audio,
} from "@huggingface/transformers";

// Load processor and model
const model_id = "onnx-community/gemma-4-E2B-it-ONNX";
const processor = await AutoProcessor.from_pretrained(model_id);
const model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, {
  dtype: "q4f16",
  device: "webgpu",
  progress_callback: (info) => {
    if (info.status === "progress_total") {
      // console.log(`Loading model: ${info.progress}%`);
    }
  },
});

// Prepare prompt
const messages = [
  {
    role: "user",
    content: [
      { type: "image" },
      { type: "audio" },
      {
        type: "text",
        text: "Describe this image in detail and transcribe this audio verbatim.",
      },
    ],
  },
];
const prompt = processor.apply_chat_template(messages, {
  enable_thinking: false,
  add_generation_prompt: true,
});

// Prepare inputs
const image = await load_image("https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/artemis.jpeg");
const audio = await read_audio("https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav");
const inputs = await processor(prompt, image, audio, {
  add_special_tokens: false,
});

// Generate output
const outputs = await model.generate({
  ...inputs,
  max_new_tokens: 512,
  do_sample: false,
  streamer: new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: false,
    // callback_function: (text) => { /* Do something with the streamed output */ },
  }),
});

// Decode output
const decoded = processor.batch_decode(
  outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
  { skip_special_tokens: true },
);
console.log(decoded[0]);
```

### ONNX Runtime (Python)

```py
import onnxruntime
import numpy as np
from transformers import AutoConfig, AutoProcessor, GenerationConfig
import os
from huggingface_hub import snapshot_download

# 1. Load models
## Load config and processor
model_id = "onnx-community/gemma-4-E2B-it-ONNX"
processor = AutoProcessor.from_pretrained(model_id)
config = AutoConfig.from_pretrained(model_id)
generation_config = GenerationConfig.from_pretrained(model_id)

## Load sessions
audio_model = "onnx/audio_encoder_q4.onnx"
vision_model = "onnx/vision_encoder_q4.onnx"
embed_model = "onnx/embed_tokens_q4.onnx"
decoder_model = "onnx/decoder_model_merged_q4.onnx"
model_dir = snapshot_download(model_id, allow_patterns=[f"{audio_model}*",  f"{vision_model}*", f"{embed_model}*", f"{decoder_model}*"])
audio_model_path   = os.path.join(model_dir, audio_model)
vision_model_path  = os.path.join(model_dir, vision_model)
embed_model_path   = os.path.join(model_dir, embed_model)
decoder_model_path = os.path.join(model_dir, decoder_model)

providers = ['CPUExecutionProvider']
vision_session  = onnxruntime.InferenceSession(vision_model_path, providers=providers)
audio_session   = onnxruntime.InferenceSession(audio_model_path, providers=providers)
embed_session   = onnxruntime.InferenceSession(embed_model_path, providers=providers)
decoder_session = onnxruntime.InferenceSession(decoder_model_path, providers=providers)

## Set config values
eos_token_id = generation_config.eos_token_id
image_token_id = config.image_token_id
audio_token_id = config.audio_token_id

# 2. Prepare inputs
## Create input messages
messages = [
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "In detail, describe the following audio and image."},
            {"type": "audio", "audio": "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav"},
            {"type": "image", "image": "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/artemis.jpeg"},
        ],
    },
]
inputs = processor.apply_chat_template(
    messages,
    add_generation_prompt=True,
    tokenize=True,
    return_dict=True,
    return_tensors="pt",
)
input_ids = inputs["input_ids"].numpy()
attention_mask = inputs["attention_mask"].numpy()
position_ids = np.cumsum(attention_mask, axis=-1) - 1

pixel_values = inputs["pixel_values"].numpy() if "pixel_values" in inputs else None
pixel_position_ids = inputs["image_position_ids"].numpy() if "image_position_ids" in inputs else None
input_features = inputs["input_features"].numpy().astype(np.float32) if "input_features" in inputs else None
input_features_mask = inputs["input_features_mask"].numpy() if "input_features_mask" in inputs else None

## Prepare decoder inputs
batch_size = input_ids.shape[0]
num_logits_to_keep = np.array(1, dtype=np.int64)
past_key_values = {
    inp.name: np.zeros(
        [batch_size, inp.shape[1], 0, inp.shape[3]],
        dtype=np.float32 if inp.type == "tensor(float)" else np.float16,
    )
    for inp in decoder_session.get_inputs()
    if inp.name.startswith("past_key_values")
}

# 3. Generation loop
max_new_tokens = 1024
generated_tokens = np.array([[]], dtype=np.int64)
image_features = None
audio_features = None
for i in range(max_new_tokens):
    inputs_embeds, per_layer_inputs = embed_session.run(None, {"input_ids": input_ids})
    if image_features is None and pixel_values is not None:
        image_features = vision_session.run(["image_features"], {"pixel_values": pixel_values, "pixel_position_ids": pixel_position_ids})[0]
        mask = (input_ids == image_token_id).reshape(-1)
        flat_embeds = inputs_embeds.reshape(-1, inputs_embeds.shape[-1])
        flat_embeds[mask] = image_features
        inputs_embeds = flat_embeds.reshape(inputs_embeds.shape)

    if audio_features is None and input_features is not None and input_features_mask is not None:
        audio_features = audio_session.run(
            ["audio_features"],
            {"input_features": input_features, "input_features_mask": input_features_mask},
        )[0]
        mask = (input_ids == audio_token_id).reshape(-1)
        flat_embeds = inputs_embeds.reshape(-1, inputs_embeds.shape[-1])
        flat_embeds[mask] = audio_features
        inputs_embeds = flat_embeds.reshape(inputs_embeds.shape)

    logits, *present_key_values = decoder_session.run(None, dict(
        inputs_embeds=inputs_embeds,
        attention_mask=attention_mask,
        per_layer_inputs=per_layer_inputs,
        position_ids=position_ids,
        num_logits_to_keep=num_logits_to_keep,
        **past_key_values,
    ))

    ## Update values for next generation loop
    input_ids = logits[:, -1].argmax(-1, keepdims=True)
    attention_mask = np.concatenate([attention_mask, np.ones_like(input_ids)], axis=-1)
    position_ids = position_ids[:, -1:] + 1
    for j, key in enumerate(past_key_values):
        past_key_values[key] = present_key_values[j]

    generated_tokens = np.concatenate([generated_tokens, input_ids], axis=-1)
    if np.isin(input_ids, eos_token_id).any():
        break

    ## (Optional) Streaming
    print(processor.decode(input_ids[0]), end="", flush=True)
print()

# 4. Output result
print(processor.batch_decode(generated_tokens, skip_special_tokens=True)[0])
```

## **Model Data**

Data used for model training and how the data was processed.

### **Training Dataset**

Our pre-training dataset is a large-scale, diverse collection of data encompassing a wide range of domains and modalities, which includes web documents, code, images, audio, with a cutoff date of January 2025. Here are the key components:

* **Web Documents**: A diverse collection of web text ensures the model is exposed to a broad range of linguistic styles, topics, and vocabulary. The training dataset includes content in over 140 languages.  
* **Code**: Exposing the model to code helps it to learn the syntax and patterns of programming languages, which improves its ability to generate code and understand code-related questions.  
* **Mathematics**: Training on mathematical text helps the model learn logical reasoning, symbolic representation, and to address mathematical queries.  
* **Images**: A wide range of images enables the model to perform image analysis and visual data extraction tasks.

The combination of these diverse data sources is crucial for training a powerful multimodal model that can handle a wide variety of different tasks and data formats.

### **Data Preprocessing**

Here are the key data cleaning and filtering methods applied to the training data:

* **CSAM Filtering**: Rigorous CSAM (Child Sexual Abuse Material) filtering was applied at multiple stages in the data preparation process to ensure the exclusion of harmful and illegal content.  
* **Sensitive Data Filtering**: As part of making Gemma pre-trained models safe and reliable, automated techniques were used to filter out certain personal information and other sensitive data from training sets.  
* **Additional methods**: Filtering based on content quality and safety in line with [our policies](https://ai.google/static/documents/ai-responsibility-update-published-february-2025.pdf).

## **Ethics and Safety**

As open models become central to enterprise infrastructure, provenance and security are paramount. Developed by Google DeepMind, Gemma 4 undergoes the same rigorous safety evaluations as our proprietary Gemini models. 

### **Evaluation Approach**

Gemma 4 models were developed in partnership with internal safety and responsible AI teams. A range of automated as well as human evaluations were conducted to help improve model safety. These evaluations align with [Google’s AI principles](https://ai.google/principles/), as well as safety policies, which aim to prevent our generative AI models from generating harmful content, including:

* Content related to child sexual abuse material and exploitation   
* Dangerous content (e.g., promoting suicide, or instructing in activities that could cause real-world harm)   
* Sexually explicit content  
* Hate speech (e.g., dehumanizing members of protected groups)   
* Harassment (e.g., encouraging violence against people)

### **Evaluation Results**

For all areas of safety testing, we saw major improvements in all categories of content safety relative to previous Gemma models. Overall, Gemma 4 models significantly outperform Gemma 3 and 3n models in improving safety, while keeping unjustified refusals low. All testing was conducted without safety filters to evaluate the model capabilities and behaviors. For both text-to-text and image-to-text, and across all model sizes, the model produced minimal policy violations, and showed significant improvements over previous Gemma models' performance. 

## **Usage and Limitations**

These models have certain limitations that users should be aware of.

### **Intended Usage**

Multimodal models (capable of processing vision, language, and/or audio) have a wide range of applications across various industries and domains. The following list of potential uses is not comprehensive. The purpose of this list is to provide contextual information about the possible use-cases that the model creators considered as part of model training and development.

* **Content Creation and Communication**  
  * **Text Generation**: These models can be used to generate creative text formats such as poems, scripts, code, marketing copy, and email drafts.  
  * **Chatbots and Conversational AI**: Power conversational interfaces for customer service, virtual assistants, or interactive applications.  
  * **Text Summarization**: Generate concise summaries of a text corpus, research papers, or reports.  
  * **Image Data Extraction**: These models can be used to extract, interpret, and summarize visual data for text communications.  
  * **Audio Processing and Interaction**: The smaller models (E2B and E4B) can analyze and interpret audio inputs, enabling voice-driven interactions and transcriptions.  
* **Research and Education**  
  * **Natural Language Processing (NLP) and VLM Research**: These models can serve as a foundation for researchers to experiment with VLM and NLP techniques, develop algorithms, and contribute to the advancement of the field.  
  * **Language Learning Tools**: Support interactive language learning experiences, aiding in grammar correction or providing writing practice.  
  * **Knowledge Exploration**: Assist researchers in exploring large bodies of text by generating summaries or answering questions about specific topics.

### **Limitations**

* **Training Data**  
  * The quality and diversity of the training data significantly influence the model's capabilities. Biases or gaps in the training data can lead to limitations in the model's responses.  
  * The scope of the training dataset determines the subject areas the model can handle effectively.  
* **Context and Task Complexity**  
  * Models perform well on tasks that can be framed with clear prompts and instructions. Open-ended or highly complex tasks might be challenging.  
  * A model's performance can be influenced by the amount of context provided (longer context generally leads to better outputs, up to a certain point).  
* **Language Ambiguity and Nuance**  
  * Natural language is inherently complex. Models might struggle to grasp subtle nuances, sarcasm, or figurative language.  
* **Factual Accuracy**  
  * Models generate responses based on information they learned from their training datasets, but they are not knowledge bases. They may generate incorrect or outdated factual statements.  
* **Common Sense**  
  * Models rely on statistical patterns in language. They might lack the ability to apply common sense reasoning in certain situations.

### **Ethical Considerations and Risks**

The development of vision-language models (VLMs) raises several ethical concerns. In creating an open model, we have carefully considered the following:

* **Bias and Fairness**  
  * VLMs trained on large-scale, real-world text and image data can reflect socio-cultural biases embedded in the training material. Gemma 4 models underwent careful scrutiny, input data pre-processing, and post-training evaluations as reported in this card to help mitigate the risk of these biases.  
* **Misinformation and Misuse**  
  * VLMs can be misused to generate text that is false, misleading, or harmful.  
  * Guidelines are provided for responsible use with the model, see the [Responsible Generative AI Toolkit](https://ai.google.dev/responsible).  
* **Transparency and Accountability**  
  * This model card summarizes details on the models' architecture, capabilities, limitations, and evaluation processes.  
  * A responsibly developed open model offers the opportunity to share innovation by making VLM technology accessible to developers and researchers across the AI ecosystem.

**Risks identified and mitigations**:

* **Generation of harmful content**: Mechanisms and guidelines for content safety are essential. Developers are encouraged to exercise caution and implement appropriate content safety safeguards based on their specific product policies and application use cases.  
* **Misuse for malicious purposes**: Technical limitations and developer and end-user education can help mitigate against malicious applications of VLMs. Educational resources and reporting mechanisms for users to flag misuse are provided.   
* **Privacy violations**: Models were trained on data filtered for removal of certain personal information and other sensitive data. Developers are encouraged to adhere to privacy regulations with privacy-preserving techniques.  
* **Perpetuation of biases**: It's encouraged to perform continuous monitoring (using evaluation metrics, human review) and the exploration of de-biasing techniques during model training, fine-tuning, and other use cases.

### **Benefits**

At the time of release, this family of models provides high-performance open vision-language model implementations designed from the ground up for responsible AI development compared to similarly sized models.
