#!/bin/bash
# Removes ||spoilers|| from .md files in .gitattributes
sed -E 's/\|\|[^|]*\|\|/<!-- REDACTED -->/g'