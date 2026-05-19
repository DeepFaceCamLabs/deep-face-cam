import os

# Utility function to support unicode characters in file paths for reading
def imread_unicode(path, flags=None):
    import cv2
    import numpy as np

    if flags is None:
        flags = cv2.IMREAD_COLOR
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), flags)

# Utility function to support unicode characters in file paths for writing
def imwrite_unicode(path, img, params=None):
    import cv2

    root, ext = os.path.splitext(path)
    if not ext:
        ext = ".png"
        result, encoded_img = cv2.imencode(ext, img, params if params else [])
        result, encoded_img = cv2.imencode(f".{ext}", img, params if params is not None else [])
        encoded_img.tofile(path)
        return True
    return False
