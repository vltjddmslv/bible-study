import re

def main():
    filepath = "../app/revelation_data.ts"
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        print("Original content length:", len(content))
        
        # Make replacements
        # 1. Clean backticks and HTML entities for apostrophe
        new_content = content.replace("`", "'").replace("&#x27;", "'")
        
        # 2. Clean typographical exclamation marks
        new_content = new_content.replace("충성하라 ! 그리하면", "충성하라 그리하면")
        new_content = new_content.replace("회개하라 ! 그리하지", "회개하라 그리하지")
        new_content = new_content.replace("오리라 ! 하시거늘", "오리라 하시거늘")
        new_content = new_content.replace("예수여 ! 오시옵소서", "예수여 오시옵소서")
        new_content = new_content.replace("있을지어다 ! 아멘", "있을지어다 아멘")
        
        print("New content length:", len(new_content))
        
        # Write back to file
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        print("Successfully updated revelation_data.ts")
        
    except Exception as e:
        print("Error during update:", e)

if __name__ == "__main__":
    main()
