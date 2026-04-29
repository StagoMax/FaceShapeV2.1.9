POST https://ark.ap-southeast.bytepluses.com/api/v3/images/generations Try
This document describes the input and output parameters for the image generation API, including  Use it to check parameter definitions when calling the API.
Introduction to the image generation capabilities of different models
seedream-4.0
Generate multiple image in sequence (a batch of related images generated based on your input; set sequential_image_generation to auto)
Generate a batch of related images based on your input of multiple reference images (2-10) + text prompt (the number of input reference images + the number of final output images ≤ 15).
Generate a batch of related images (up to 14) from a single reference image + text prompt.
Generate a batch of related images (up to 15) from text prompt.
Generate a single image (set sequential_image_generation to disabled).
Generate a single image from multiple reference images (2-10) + text prompt.
Generate a single image from a single reference image + text prompt.
Generate a single image from text prompt.
seedream-3.0-t2i
Generate a single image from a text prompt.
seededit-3.0-i2i
Generate a single image from a single reference image+text prompt.

Quick start
Authentication
This interface only supports API Key authentication. Please obtain a long-term API Key on the  API Key management page.

Experience Center 
Model List 
Model Billing 
API Key

API Call Guide 
API Reference 
FAQs 
Model Activation

Request parameters
Request body

model String required
The model for this request: Model ID or inference endpoint (Endpoint ID).

prompt string required
The prompt for image generation. (View prompt guide: Seedream 4.0, Seedream 3.0)
The recommended length is no more than 600 English words. If the prompt is too long, the information may become scattered. The model might ignore details and only concentrate on the main points, resulting in a image with missing elements.

image string/array 
Only seedream-4.0 and seededit-3.0-i2i support this parameter.
Enter the Base64 encoding or an accessible URL of the image to edit. Among the models, bytedance-seedream-4.0 supports inputting a single image or multiple images (see the multi-image blending example), while bytedance-seededit-3.0-i2 only supports single-image input.
Image URL: Make sure that the image URL is accessible.
Base64 encoding: The format must be data:image/<image format>;base64,<Base64 encoding>. Note: <image format> must be in lowercase, e.g., data:image/png;base64,<base64_image>.
Description
An input image must meet the following requirements:
Image format: jpeg, png
Aspect ratio (width/height): In the range [1/3, 3]
Width and height (px): > 14
Size: No more than 10 MB
The value of total pixels: No more than 6000×6000
Seedream-4.0 supports uploading a maximum of 10 reference images.

size String  

seedream-4.0
seedream-3.0-t2i
seededit-3.0-i2i
Set the width and height of the generated image in pixels.
Default value: 1024x1024
The value range of total pixels:  [512x512, 2048x2048]
Recommended width and height:
Aspect ratio
Width and Height Pixel Values
1:1
1024x1024
4:3
1152x864
3:4
864x1152
16:9
1280x720
9:16
720x1280
3:2
1248x832
2:3
832x1248
21:9
1512x648

Specifies the width and height of the generated image in pixels. Only adaptive is currently supported.
adaptive. Compare your input image's dimensions with those in the table below and select the closest match for the output image. Specifically, the system selects the first available aspect ratio with the smallest difference from that of the original image.
Preset width and height in pixels
Width/Height
Width
High
0.33
512
1536
0.35
544
1536
0.38
576
1536
0.4
608
1536
0.42
640
1536
0.47
640
1376
0.51
672
1312
0.55
704
1280
0.56
736
1312
0.6
768
1280
0.63
768
1216
0.66
800
1216
0.67
832
1248
0.7
832
1184
0.72
832
1152
0.75
864
1152
0.78
896
1152
0.82
896
1088
0.85
928
1088
0.88
960
1088
0.91
992
1088
0.94
1024
1088
0.97
1024
1056
1
1024
1024
1.06
1056
992
1.1
1088
992
1.17
1120
960
1.24
1152
928
1.29
1152
896
1.33
1152
864
1.42
1184
832
1.46
1216
832
1.5
1248
832
1.56
1248
800
1.62
1248
768
1.67
1280
768
1.74
1280
736
1.82
1280
704
1.78
1312
736
1.86
1312
704
1.95
1312
672
2
1344
672
2.05
1376
672
2.1
1408
672
2.2
1408
640
2.25
1440
640
2.3
1472
640
2.35
1504
640
2.4
1536
640
2.53
1536
608
2.67
1536
576
2.82
1536
544
3
1536
512

Set the specification for the generated image. Two methods are available but cannot be used together.
Method 1 | Example: Specify the resolution of the generated image, and describe its aspect ratio, shape, or purpose in the prompt using natural language, let the model ultimately determine the final image width and height.
Optional values: 1K, 2K, 4K
Method 2 | Example: Specify the width and height of the generated image in pixels:
Default value: 2048x2048
The value range of total pixels: [1280x720, 4096x4096] 
The aspect ratio value range: [1/16, 16]

Recommended width and height:

Aspect ratio

Width and Height Pixel Values

1:1

2048x2048

4:3

2304x1728

3:4

1728x2304

16:9

2560x1440

9:16

1440x2560

3:2

2496x1664

2:3

1664x2496

21:9

3024x1296

seed integer Default: -1
Only seedream-3.0-t2i and seededit-3.0-i2i support this parameter.
A random seed that controls the randomness of the generated content. The value range is [-1, 2147483647].
warning
For the same request, the model generates different results when given different seed values. For example, not specifying a seed, setting it to -1 (which uses a random number), or manually changing the seed will produce different results.
For the same request, the model will generate similar results when given the same seed value, but they are not guaranteed to be identical.

sequential_image_generation String  Default: disabled
This parameter is only supported on seedream-4.0 | View batch image output example
Controls whether to disable the batch generation feature.
Description
Batch image generation: a batch of thematically related images generated based on your input content.
Valid values:
auto: In automatic mode, the model automatically determines whether to return multiple images and how many images it will contain based on the user's prompt.
disabled: Disables batch generation feature. The model will only generate one image.

sequential_image_generation_options object 
Only seedream-4.0 supports this parameter.
Configuration for the batch image generation feature. This parameter is only effective when sequential_image_generation is set to auto.
Attributes

sequential_image_generation_options.max_images integer Default: 15
Specifies the maximum number of images to generate in this request.
Value range: [1, 15]
Description
The actual number of generated images is affected by max_images and the number of input reference images. Number of input reference images + Number of generated images ≤ 15.

stream  boolean Default: false
Only seedream-4.0 supports this parameter | View the Streaming Output Example
Controls whether to enable streaming output mode.
false: non-streaming output mode. All output images are returned one-shot after all images have been generated.
true: streaming output mode. Each output image is returned immediately after it is generated. Streaming output mode is effective for both single and batch generation.

guidance_scale Float
Default value for seedream-3.0-t2i: 2.5
Default value for seededit-3.0-i2i: 5.5
seedream-4.0 is not supported.
This parameter controls the consistency between the model's output and the prompt, determining the degree of freedom for image generation. A higher value reduces the model's freedom and increases relevance to the user's prompt.
Valid values: [1, 10] 。

response_format String Default: url
Specifies the return format for the generated image.
The generated image is in JPEG format and can be returned in the following two ways:
url: returns a download link for the image. The link is valid for 24 hours after the image is generated. Download the image promptly.
b64_json: Returns image data in JSON format as a Base64-encoded string.

watermark  Boolean Default: true
Adds a watermark to the generated image.
false: Does not add a watermark.
true: Adds a watermark with the text "AI generated" in the bottom-right corner of the image.

optimize_prompt_optionsnew object 
Only seedream-4.0 support this parameter.
Configuration for prompt optimization feature.
optimize_prompt_options.mode string Default: standard
Set the mode for the prompt optimization feature. By default, seedream-4.0 uses the standard mode to optimize the prompts entered by users.
standard：Standard mode. It generates content with higher quality but takes longer time.
fast：Fast mode. It generates content in shorter time but with average quality.

Response parameters
Streaming response parameters
See the Documentation.

Non-streaming response parameters

model String
The model ID used for this request (model name-version).

created integer
The Unix timestamp in seconds of the creation time of the request.

data array
Information about the output images.
Description
When generating a batch of images with the seedream-4.0 model, if an image fails to generate：
If the failure is due to the rejection by content filter: The next picture generation task will still be requested, not affecting the generation of other pictures in the same request.
If the failure is due to an internal service error (500): The next picture generation task will not be requested.
Possible type
Image information object
Successfully generated image information.
Attributes
data.url string
The URL of the image, returned when response_format is specified as url. This link will expire within 24 hours of generation. Be sure to save the image promptly.

data.b64_json String
The Base64 information of the image, returned when response_format is specified as b64_json.

data.size String
Only seedream-4.0 supports this field.
The width and height of the image in pixels, in the format <width>x<height>, such as 2048×2048.

Error message object
Error message for a failed image generation.
Attributes
data.error Object
Error message structure.
Attributes

data.error.code
The error code for a failed image generation. See Error Codes.

data.error.message
Error message for a failed image generation.

usage Object
Usage information for the current request.
Attributes

usage.generated_images integer
The number of images successfully generated by the model, excluding failed generations.
Billing is based on the number of successfully generated images.

usage.output_tokens integer
The number of tokens consumed for the images generated by the model.
The calculation logic is to calculate sum(image width*image height)/256 and then round the result to an integer.

usage.total_tokens integer
The total number of tokens consumed by this request.
Currently, input tokens are not calculated, so this value is the same as output_tokens.

error  object
The error message for this request, if any.
Attributes

error.code String 
See Error Codes.

error.message String
Error message

