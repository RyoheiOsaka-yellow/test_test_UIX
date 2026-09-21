"""CPU prototype of GaME (Gaussian Mapping for Evolving Scenes).

The package re-implements the change-detection and keyframe-management core of
https://github.com/VladimirYugay/GaME on top of a small, differentiable
CPU Gaussian-splat renderer and a synthetic RGB-D scene generator, so the
algorithm can be run and inspected without CUDA, SAM masks or datasets.
"""
