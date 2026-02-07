"""
Firebase Cloud Functions for media compression
- Image compression to WebP
- Audio compression (reduce bitrate)
"""

import io
import tempfile
import os
from firebase_functions import https_fn, storage_fn, options
from firebase_admin import initialize_app, storage
from PIL import Image
from pydub import AudioSegment

# Initialize Firebase Admin
initialize_app()

# CORS configuration
cors_options = options.CorsOptions(
    cors_origins=["*"],
    cors_methods=["GET", "POST", "OPTIONS"],
)


@https_fn.on_request(
    cors=cors_options,
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
)
def compress_image(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint to compress uploaded image to WebP format.
    Expects multipart form data with 'image' field.
    Returns compressed WebP image as base64 or uploads to Storage.
    """
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    
    try:
        # Get image from request
        if 'image' not in req.files:
            return https_fn.Response("No image provided", status=400)
        
        image_file = req.files['image']
        max_width = int(req.form.get('maxWidth', 1200))
        quality = int(req.form.get('quality', 80))
        
        # Open and process image
        img = Image.open(image_file)
        
        # Convert RGBA to RGB if necessary (WebP supports both, but for consistency)
        if img.mode in ('RGBA', 'P'):
            # Create white background for transparency
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if too large
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        # Save as WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=quality, method=6)
        output.seek(0)
        
        # Return compressed image
        return https_fn.Response(
            output.getvalue(),
            status=200,
            headers={
                "Content-Type": "image/webp",
                "Content-Disposition": "attachment; filename=compressed.webp"
            }
        )
        
    except Exception as e:
        print(f"Error compressing image: {e}")
        return https_fn.Response(f"Error: {str(e)}", status=500)


@https_fn.on_request(
    cors=cors_options,
    memory=options.MemoryOption.GB_1,
    timeout_sec=300,
)
def compress_audio(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint to compress uploaded audio file.
    Converts to opus/webm with reduced bitrate.
    """
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)
    
    try:
        if 'audio' not in req.files:
            return https_fn.Response("No audio provided", status=400)
        
        audio_file = req.files['audio']
        bitrate = req.form.get('bitrate', '64k')
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_input:
            audio_file.save(tmp_input)
            tmp_input_path = tmp_input.name
        
        try:
            # Load audio
            audio = AudioSegment.from_file(tmp_input_path)
            
            # Convert to mono if stereo (voice doesn't need stereo)
            if audio.channels > 1:
                audio = audio.set_channels(1)
            
            # Set sample rate to 48000 (good for voice)
            audio = audio.set_frame_rate(48000)
            
            # Export with compression
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_output:
                tmp_output_path = tmp_output.name
            
            audio.export(
                tmp_output_path,
                format='webm',
                codec='libopus',
                bitrate=bitrate,
                parameters=['-vbr', 'on', '-compression_level', '10']
            )
            
            # Read compressed file
            with open(tmp_output_path, 'rb') as f:
                compressed_data = f.read()
            
            # Clean up temp files
            os.unlink(tmp_output_path)
            
            return https_fn.Response(
                compressed_data,
                status=200,
                headers={
                    "Content-Type": "audio/webm",
                    "Content-Disposition": "attachment; filename=compressed.webm"
                }
            )
            
        finally:
            # Clean up input temp file
            os.unlink(tmp_input_path)
            
    except Exception as e:
        print(f"Error compressing audio: {e}")
        return https_fn.Response(f"Error: {str(e)}", status=500)


# Storage trigger: Auto-compress images when uploaded
@storage_fn.on_object_finalized(
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
)
def auto_compress_image(event: storage_fn.CloudEvent[storage_fn.StorageObjectData]):
    """
    Automatically compress images when uploaded to Storage.
    Triggered when a new file is uploaded to the 'memories/' path.
    """
    file_path = event.data.name
    content_type = event.data.content_type
    
    # Only process images in memories folder, skip already compressed
    if not file_path.startswith('memories/'):
        return
    if not content_type or not content_type.startswith('image/'):
        return
    if file_path.endswith('.webp') or '_compressed' in file_path:
        return
    
    try:
        bucket = storage.bucket(event.data.bucket)
        blob = bucket.blob(file_path)
        
        # Download image
        image_data = blob.download_as_bytes()
        img = Image.open(io.BytesIO(image_data))
        
        # Process image
        if img.mode in ('RGBA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if needed
        max_width = 1200
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        # Save as WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=80, method=6)
        output.seek(0)
        
        # Upload compressed version
        new_path = file_path.rsplit('.', 1)[0] + '_compressed.webp'
        new_blob = bucket.blob(new_path)
        new_blob.upload_from_file(output, content_type='image/webp')
        
        # Make it public
        new_blob.make_public()
        
        print(f"Compressed {file_path} -> {new_path}")
        
    except Exception as e:
        print(f"Error auto-compressing image: {e}")
