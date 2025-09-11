#%%
import importlib
import scripts.web_detection.query as wdquery

#%%
importlib.reload(wsquery)


#%% run 2029-09-10
token = None
service_account_key_path = "./secrets/service_account_key.json"
wdquery.vision_loop("./data/di-100/images", limit = 3, token=token, service_account_key_path=service_account_key_path)



#%%
print("new console")