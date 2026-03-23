use crate::db_context::DbContext;
use crate::error::Error::MissingBaseEnvironment;
use crate::error::Result;
use crate::models::{Environment, EnvironmentIden, EnvironmentVariable};
use crate::util::UpdateSource;
use log::{info, warn};

impl<'a> DbContext<'a> {
    pub fn get_environment(&self, id: &str) -> Result<Environment> {
        self.find_one(EnvironmentIden::Id, id)
    }

    pub fn get_environment_by_folder_id(&self, folder_id: &str) -> Result<Option<Environment>> {
        let mut environments: Vec<Environment> =
            self.find_many(EnvironmentIden::ParentId, folder_id, None)?;
        // Sort so we return the most recently updated environment
        environments.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(environments.get(0).cloned())
    }

    /// Returns all base environments (groups) for the workspace, sorted by sort_priority.
    /// Creates one if none exist.
    pub fn list_base_environments(&self, workspace_id: &str) -> Result<Vec<Environment>> {
        let environments = self.list_environments_ensure_base(workspace_id)?;
        let mut base_environments: Vec<Environment> = environments
            .into_iter()
            .filter(|e| e.parent_model == "workspace")
            .collect();
        base_environments.sort_by(|a, b| {
            a.sort_priority
                .partial_cmp(&b.sort_priority)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        if base_environments.is_empty() {
            return Err(MissingBaseEnvironment(workspace_id.to_string()));
        }
        Ok(base_environments)
    }

    /// Lists environments and will create a base environment if one doesn't exist.
    /// Also migrates legacy sub-environments with null parent_id to the first base environment.
    pub fn list_environments_ensure_base(&self, workspace_id: &str) -> Result<Vec<Environment>> {
        let mut environments = self.list_environments_dangerous(workspace_id)?;

        let base_environment = environments.iter().find(|e| e.parent_model == "workspace");

        if let None = base_environment {
            let e = self.upsert_environment(
                &Environment {
                    workspace_id: workspace_id.to_string(),
                    name: "Global Variables".to_string(),
                    parent_model: "workspace".to_string(),
                    ..Default::default()
                },
                &UpdateSource::Background,
            )?;
            info!("Created base environment {} for {workspace_id}", e.id);
            environments.push(e);
        }

        // Migrate legacy sub-environments with null parent_id
        let first_base_id = environments
            .iter()
            .find(|e| e.parent_model == "workspace")
            .map(|e| e.id.clone());
        if let Some(base_id) = first_base_id {
            for env in &mut environments {
                if env.parent_model == "environment" && env.parent_id.is_none() {
                    info!("Migrating sub-environment {} to base env {base_id}", env.id);
                    env.parent_id = Some(base_id.clone());
                    let _ = self.upsert(env, &UpdateSource::Background);
                }
            }
        }

        Ok(environments)
    }

    /// List environments for a workspace. Prefer list_environments_ensure_base()
    fn list_environments_dangerous(&self, workspace_id: &str) -> Result<Vec<Environment>> {
        Ok(self.find_many::<Environment>(EnvironmentIden::WorkspaceId, workspace_id, None)?)
    }

    pub fn delete_environment(
        &self,
        environment: &Environment,
        source: &UpdateSource,
    ) -> Result<Environment> {
        // If deleting a base environment (group), also delete its sub-environments
        if environment.parent_model == "workspace" {
            let sub_environments: Vec<Environment> = self
                .list_environments_dangerous(&environment.workspace_id)?
                .into_iter()
                .filter(|e| e.parent_model == "environment" && e.parent_id.as_deref() == Some(&environment.id))
                .collect();
            for sub_env in sub_environments {
                let _ = self.delete(&sub_env, source);
            }
        }

        let deleted_environment = self.delete(environment, source)?;

        // Recreate a base environment if we happened to delete the last one
        self.list_environments_ensure_base(&environment.workspace_id)?;

        Ok(deleted_environment)
    }

    pub fn delete_environment_by_id(&self, id: &str, source: &UpdateSource) -> Result<Environment> {
        let environment = self.get_environment(id)?;
        self.delete_environment(&environment, source)
    }

    pub fn duplicate_environment(
        &self,
        environment: &Environment,
        source: &UpdateSource,
    ) -> Result<Environment> {
        let mut environment = environment.clone();
        environment.id = "".to_string();
        self.upsert_environment(&environment, source)
    }

    /// Find other environments with the same parent folder
    fn list_duplicate_folder_environments(&self, environment: &Environment) -> Vec<Environment> {
        if environment.parent_model != "folder" {
            return Vec::new();
        }

        self.list_environments_dangerous(&environment.workspace_id)
            .unwrap_or_default()
            .into_iter()
            .filter(|e| {
                e.id != environment.id
                    && e.parent_model == "folder"
                    && e.parent_id == environment.parent_id
            })
            .collect()
    }

    pub fn upsert_environment(
        &self,
        environment: &Environment,
        source: &UpdateSource,
    ) -> Result<Environment> {
        let cleaned_variables = environment
            .variables
            .iter()
            .filter(|v| !v.name.is_empty() || !v.value.is_empty())
            .cloned()
            .collect::<Vec<EnvironmentVariable>>();

        // Sometimes a new environment can be created via sync/import, so we'll just delete
        // the others when that happens. Not the best, but it's good for now.
        let duplicates = self.list_duplicate_folder_environments(environment);
        for duplicate in duplicates {
            warn!(
                "Deleting duplicate environment {} for folder {:?}",
                duplicate.id, environment.parent_id
            );
            _ = self.delete(&duplicate, source);
        }

        // Automatically update the environment name based on the folder name
        let mut name = environment.name.clone();
        match (environment.parent_model.as_str(), environment.parent_id.as_deref()) {
            ("folder", Some(folder_id)) => {
                if let Ok(folder) = self.get_folder(folder_id) {
                    name = format!("{} Environment", folder.name);
                }
            }
            _ => {}
        }

        self.upsert(
            &Environment { name, variables: cleaned_variables, ..environment.clone() },
            source,
        )
    }

    pub fn resolve_environments(
        &self,
        workspace_id: &str,
        folder_id: Option<&str>,
        active_environment_ids: &[String],
    ) -> Result<Vec<Environment>> {
        let mut environments = Vec::new();

        if let Some(folder_id) = folder_id {
            let folder = self.get_folder(folder_id)?;

            // Add current folder's environment
            if let Some(e) = self.get_environment_by_folder_id(folder_id)? {
                environments.push(e);
            };

            // Recurse up
            let ancestors = self.resolve_environments(
                workspace_id,
                folder.folder_id.as_deref(),
                active_environment_ids,
            )?;
            environments.extend(ancestors);
        } else {
            // Build chain from all base environments (groups), sorted by sort_priority.
            // make_vars_hashmap() iterates in reverse, so items earlier in the vec
            // have higher priority. We want later groups (higher sort_priority) to
            // override earlier ones, so we iterate in ascending sort_priority order.
            let base_environments = self.list_base_environments(workspace_id)?;
            for base_env in &base_environments {
                // Check if any of the active environment IDs is a sub-env of this group
                let active_sub = active_environment_ids.iter().find_map(|id| {
                    self.get_environment(id).ok().filter(|e| {
                        e.parent_model == "environment"
                            && e.parent_id.as_deref() == Some(&base_env.id)
                    })
                });

                if let Some(sub_env) = active_sub {
                    environments.push(sub_env);
                }
                environments.push(base_env.clone());
            }
        }

        Ok(environments)
    }
}
