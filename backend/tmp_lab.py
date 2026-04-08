import cv2
import numpy as np

# Test Red
r = np.array([[[1.0, 0.0, 0.0]]], dtype='float32')
lab = cv2.cvtColor(r, cv2.COLOR_RGB2Lab)
print("Red to Lab:", lab)

rgb_back = cv2.cvtColor(lab, cv2.COLOR_Lab2RGB)
print("Lab to RGB:", rgb_back)

# Test Grey
g = np.array([[[0.5, 0.5, 0.5]]], dtype='float32')
lab_g = cv2.cvtColor(g, cv2.COLOR_RGB2Lab)
print("Grey to Lab:", lab_g)
