"""Tiny subset of albumentations used by InsightFace class definitions."""


class ImageOnlyTransform:
    def __init__(self, always_apply=False, p=0.5):
        self.always_apply = always_apply
        self.p = p

    def __call__(self, image, **kwargs):
        return self.apply(image, **kwargs)

    def apply(self, image, **kwargs):
        return image
