#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import argparse
from datetime import datetime

def scan_directory(root_path, excluded_paths=None, excluded_patterns=None):
    """
    Recursively scan a directory and create a structured representation of all files.
    
    Args:
        root_path (str): Path to the directory to scan
        excluded_paths (list): List of specific paths to exclude (relative to root_path)
        excluded_patterns (list): List of glob patterns to exclude
        
    Returns:
        dict: A structured representation of the directory
    """
    import fnmatch
    
    # Initialize empty lists if None
    if excluded_paths is None:
        excluded_paths = []
    if excluded_patterns is None:
        excluded_patterns = []
        
    # Normalize excluded paths (convert to absolute paths for easier comparison)
    normalized_excluded_paths = [os.path.normpath(os.path.join(root_path, path)) for path in excluded_paths]
    
    result = {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "root_directory": os.path.abspath(root_path),
            "excluded_paths": excluded_paths,
            "excluded_patterns": excluded_patterns
        },
        "files": []
    }
    
    # Walk through the directory
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Get relative path from root for pattern matching
        rel_dirpath = os.path.relpath(dirpath, root_path)
        
        # Filter directories to skip (modify dirnames in-place to affect walk)
        dirs_to_remove = []
        for i, dirname in enumerate(dirnames):
            dir_path = os.path.normpath(os.path.join(dirpath, dirname))
            rel_dir_path = os.path.normpath(os.path.join(rel_dirpath, dirname))
            
            # Check if directory should be excluded
            if dir_path in normalized_excluded_paths or rel_dir_path in excluded_paths:
                dirs_to_remove.append(dirname)
                continue
                
            # Check against patterns
            for pattern in excluded_patterns:
                if fnmatch.fnmatch(rel_dir_path, pattern) or fnmatch.fnmatch(dirname, pattern):
                    dirs_to_remove.append(dirname)
                    break
                    
            # Skip hidden directories
            if dirname.startswith('.'):
                dirs_to_remove.append(dirname)
        
        # Remove directories that should be skipped
        for dirname in dirs_to_remove:
            if dirname in dirnames:
                dirnames.remove(dirname)
        
        # Process files
        for filename in filenames:
            # Get the full path
            file_path = os.path.join(dirpath, filename)
            
            # Get relative path from the root directory
            rel_path = os.path.relpath(file_path, root_path)
            
            # Skip hidden files
            if filename.startswith('.'):
                continue
                
            # Skip excluded specific files
            if file_path in normalized_excluded_paths or rel_path in excluded_paths:
                print(f"Excluding file (matches excluded path): {rel_path}")
                continue
                
            # Skip files matching patterns
            skip_file = False
            for pattern in excluded_patterns:
                if fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(filename, pattern):
                    print(f"Excluding file (matches pattern '{pattern}'): {rel_path}")
                    skip_file = True
                    break
            if skip_file:
                continue
            
            # Try to read the file content
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Get file info
                file_info = {
                    "path": rel_path,
                    "name": filename,
                    "extension": os.path.splitext(filename)[1].lower(),
                    "size": os.path.getsize(file_path),
                    "last_modified": datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                    "content": content
                }
                
                result["files"].append(file_info)
            except (PermissionError, UnicodeDecodeError, IsADirectoryError):
                # Handle errors: can't read file, binary file, etc.
                print(f"Skipping file {file_path} (cannot read)")
                continue
    
    return result

def create_structure_by_type(data):
    """
    Reorganize the data by file types.
    
    Args:
        data (dict): The raw scanned data
        
    Returns:
        dict: Data reorganized by file types
    """
    structured_data = {
        "metadata": data["metadata"],
        "file_types": {}
    }
    
    for file_info in data["files"]:
        ext = file_info["extension"]
        if ext == "":
            ext = "no_extension"
        
        if ext not in structured_data["file_types"]:
            structured_data["file_types"][ext] = []
            
        structured_data["file_types"][ext].append(file_info)
    
    return structured_data

def create_structure_by_directory(data):
    """
    Reorganize the data by directory structure.
    
    Args:
        data (dict): The raw scanned data
        
    Returns:
        dict: Data reorganized by directory structure
    """
    structured_data = {
        "metadata": data["metadata"],
        "directories": {}
    }
    
    for file_info in data["files"]:
        # Split the path into directory and filename
        directory = os.path.dirname(file_info["path"])
        
        # Handle root directory
        if directory == "":
            directory = "root"
            
        # Ensure the directory exists in our structure
        if directory not in structured_data["directories"]:
            structured_data["directories"][directory] = []
            
        structured_data["directories"][directory].append(file_info)
    
    return structured_data

def save_to_json(data, output_file, indent=2):
    """
    Save the data to a JSON file.
    
    Args:
        data (dict): The data to save
        output_file (str): The output file path
        indent (int): JSON indentation level
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
    
    print(f"Data saved to {output_file}")
    print(f"Total files scanned: {len(data.get('files', []))}")

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Scan a directory and compile files into a structured JSON.')
    parser.add_argument('directory', help='Directory to scan')
    parser.add_argument('--output', '-o', default='directory_scan.json', help='Output JSON file')
    parser.add_argument('--structure', '-s', choices=['flat', 'by_type', 'by_directory'], 
                        default='flat', help='How to structure the output')
    parser.add_argument('--indent', '-i', type=int, default=2, help='JSON indentation level')
    parser.add_argument('--exclude', '-e', action='append', default=[], 
                        help='Paths to exclude (can be used multiple times)')
    parser.add_argument('--exclude-pattern', '-ep', action='append', default=[],
                        help='Glob patterns to exclude (can be used multiple times)')
    parser.add_argument('--exclude-file', '-ef', 
                        help='File containing paths and patterns to exclude (one per line)')
    
    args = parser.parse_args()
    
    # Check if directory exists
    if not os.path.isdir(args.directory):
        print(f"Error: {args.directory} is not a valid directory")
        return
    
    # Process exclusions
    excluded_paths = args.exclude.copy()
    excluded_patterns = args.exclude_pattern.copy()
    
    # Load exclusions from file if specified
    if args.exclude_file and os.path.isfile(args.exclude_file):
        try:
            with open(args.exclude_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue  # Skip empty lines and comments
                    if line.startswith('pattern:'):
                        excluded_patterns.append(line[8:].strip())
                    else:
                        excluded_paths.append(line)
            print(f"Loaded exclusions from {args.exclude_file}")
        except Exception as e:
            print(f"Error loading exclusions from file: {e}")
    
    # Print exclusion info
    if excluded_paths:
        print(f"Excluding paths: {', '.join(excluded_paths)}")
    if excluded_patterns:
        print(f"Excluding patterns: {', '.join(excluded_patterns)}")
    
    # Scan the directory
    print(f"Scanning directory: {args.directory}")
    result = scan_directory(args.directory, excluded_paths, excluded_patterns)
    
    # Restructure data if needed
    if args.structure == 'by_type':
        result = create_structure_by_type(result)
    elif args.structure == 'by_directory':
        result = create_structure_by_directory(result)
    
    # Save to JSON
    save_to_json(result, args.output, args.indent)

if __name__ == "__main__":
    main()
    
     # Comando para executar o script -- python app.py "C:\Users\Bruno Martins\Desktop\Projetos Pessoais\Node.js\Em Produção\whatsapp-devocional-IA" --exclude-file exclusion.txt