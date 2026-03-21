#!/bin/bash
# Removes lines marked with <!-- REDACT --> from .md files
sed '/<!-- REDACT -->/,/<!-- \/REDACT -->/d'